import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  private claves: CryptoKey[] = [];
  private count = 1;

  // Definimos las claves hexadecimales que vamos a usar
  private readonly CLAVES_HEX = [
    environment.keyEncryptDev, // Clave principal - DEV / QA
    environment.keyEncryptProd // Clave secundaria - PRODUCTION
  ];

  constructor() {
    this.importarClaves();
  }

  private async importarClaves(): Promise<void> {
    try {
      for (const claveHex of this.CLAVES_HEX) {
        const claveArrayBuffer = this.hexStringToArrayBuffer(claveHex);
        const clave = await window.crypto.subtle.importKey(
          'raw',
          claveArrayBuffer,
          { name: 'AES-GCM' },
          true,
          ['encrypt', 'decrypt']
        );
        this.claves.push(clave);
        console.log('Clave importada con éxito:', claveHex);
      }
    } catch (error) {
      console.error('Error al importar las claves:', error);
    }
  }

  isBase64(str: string): boolean {
    try {
      return btoa(atob(str)) == str;
    } catch (err) {
      return false;
    }
  }

  hexStringToArrayBuffer(hexString: string): ArrayBuffer {
    const bytes = new Uint8Array(hexString.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16)));
    return bytes.buffer;
  }

  encryptMessage(obj: any): Observable<string> {
    console.log('👋 Obj', JSON.stringify(obj));

    if (this.claves.length === 0) {
      return throwError(() => new Error('No hay claves de encriptación disponibles'));
    }

    // Usamos la primera clave (principal) para encriptar
    return from((async () => {
      let encoded = new TextEncoder().encode(JSON.stringify(obj));
      let iv = window.crypto.getRandomValues(new Uint8Array(16));
      let aad = window.crypto.getRandomValues(new Uint8Array(16));

      let ciphertext = await window.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv,
          additionalData: aad,
        },
        this.claves[0],
        encoded
      );

      const result = new Uint8Array(iv.length + ciphertext.byteLength + aad.length);
      const cipherTextArray = new Uint8Array(ciphertext);
      const tag = cipherTextArray.slice(cipherTextArray.length - 16, cipherTextArray.length);
      const cipher = cipherTextArray.slice(0, cipherTextArray.length - 16);
      result.set(iv);
      result.set(aad, iv.length);
      result.set(tag, aad.length + iv.length);
      result.set(cipher, aad.length + iv.length + tag.length);

      console.log('✅ ', this.count, 'Encrypted Message', btoa(String.fromCharCode(...result)));
      this.count++;

      return btoa(String.fromCharCode(...result));
    })());
  }

  private async tryDecrypt(encrypted: string, clave: CryptoKey): Promise<any> {
    try {
      const encryptedArray = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
      const iv = encryptedArray.slice(0, 16);
      const aad = encryptedArray.slice(16, 32);
      const tag = encryptedArray.slice(32, 48);
      const cipher = encryptedArray.slice(48);

      const combinedCipherText = new Uint8Array(cipher.length + tag.length);
      combinedCipherText.set(cipher);
      combinedCipherText.set(tag, cipher.length);

      const decryptedArrayBuffer = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
          additionalData: aad,
        },
        clave,
        combinedCipherText
      );

      const decryptedString = new TextDecoder().decode(decryptedArrayBuffer);
      return JSON.parse(decryptedString);
    } catch (e) {
      return null;
    }
  }

  decryptMessage(encrypted: string): Observable<any> {
    console.log('Attempting to decrypt message:', encrypted);

    if (this.claves.length === 0) {
      return throwError(() => new Error('No hay claves de desencriptación disponibles'));
    }

    return from((async () => {
      // Intentamos desencriptar con cada clave
      for (let i = 0; i < this.claves.length; i++) {
        const result = await this.tryDecrypt(encrypted, this.claves[i]);
        if (result !== null) {
          console.log(`🔓 Mensaje desencriptado exitosamente con la clave ${i + 1}`);
          return result;
        }
      }

      // Si ninguna clave funcionó, lanzamos un error
      throw new Error('No se pudo desencriptar el mensaje con ninguna de las claves disponibles');
    })());
  }
}
