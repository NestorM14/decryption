import { Injectable } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {

  private clavePredefinida: CryptoKey | undefined;
  private count = 1;

  constructor() {
    this.importarClavePredefinida();

  }

  isBase64(str: string): boolean {
    try {
      return btoa(atob(str)) == str;
    } catch (err) {
      return false;
    }
  }

  getMessageEncoding() {
    let message = 'text';
    let enc = new TextEncoder();
    console.log(enc.encode(message));
    return enc.encode(message);
  }

  importarClavePredefinida(): Observable<void> {
    const clavePredefinidaHex = '2b7e151628aed2a6abf7158809cf4f2c';
    const claveArrayBuffer = this.hexStringToArrayBuffer(clavePredefinidaHex);

    return from(
      window.crypto.subtle.importKey(
        'raw',
        claveArrayBuffer,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      ).then(clave => {
        this.clavePredefinida = clave;
        console.log('Clave predefinida importada con éxito:', this.clavePredefinida);
      }).catch(error => {
        console.error('Error al importar la clave predefinida:', error);
      })
    ).pipe(
      map(() => undefined)
    );
  }

  hexStringToArrayBuffer(hexString: string): ArrayBuffer {
    const bytes = new Uint8Array(hexString.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16)));
    return bytes.buffer;
  }

  encryptMessage(obj: any): Observable<string> {
    console.log('👋 Obj',JSON.stringify(obj));

    if (!this.clavePredefinida) {
      throw new Error('Clave de encriptación no está disponible');
    }

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
        this.clavePredefinida!,
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

      console.log('✅ ', this.count,'Encrypted Message', btoa(String.fromCharCode(...result)));
      this.count++;

      return btoa(String.fromCharCode(...result));
    })());
  }



  decryptMessage(encrypted: string): Observable<any> {
    console.log('Decrypted Messages', encrypted, this.clavePredefinida)
    if (!this.clavePredefinida) {
      throw new Error('Clave de desencriptación no está disponible');
    }

    return from((async () => {
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
        this.clavePredefinida!,
        combinedCipherText
      );

      const decryptedString = new TextDecoder().decode(decryptedArrayBuffer);
      // Intentar parsear como JSON
      try {
        console.log('🐳',JSON.parse(decryptedString));

        return JSON.parse(decryptedString);
      } catch (e) {
        // Si no es JSON, retornarlo como una cadena (HTML)
        return decryptedString;
      }
    })());
  }
}
