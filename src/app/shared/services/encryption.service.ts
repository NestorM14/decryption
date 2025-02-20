import { JsonCleanerService } from './json-cleaner.service';
import { Injectable, inject } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import * as XLSX from 'xlsx';

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

  private _jsonCleaner = inject(JsonCleanerService);

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

  encryptBulk(data: any[]): Observable<string[]> {
    if (this.claves.length === 0) {
      return throwError(() => new Error('No hay claves de encriptación disponibles'));
    }

    // Validar cada item antes de procesar
    const invalidItems = data.filter(item => !this.validateBeforeEncrypt(item));
    if (invalidItems.length > 0) {
      console.warn(`Se encontraron ${invalidItems.length} items con formato JSON inválido`);
      data = data.map(item => {
        if (!this.validateBeforeEncrypt(item)) {
          return this._jsonCleaner.cleanRawData(JSON.stringify(item));
        }
        return item;
      });
    }

    return from((async () => {
      const encryptedData: string[] = [];

      for (const item of data) {
        try {
          console.log('🔄 Procesando item:', JSON.stringify(item));

          let encoded = new TextEncoder().encode(JSON.stringify(item));
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

          const encryptedResult = btoa(String.fromCharCode(...result));
          encryptedData.push(encryptedResult);

          console.log('✅ Item encriptado:', encryptedData.length);
          this.count++;
        } catch (error) {
          console.error('Error encrypting item:', error);
          throw new Error('Error en el proceso de encriptación masiva');
        }
      }

      return encryptedData;
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
      for (let i = 0; i < this.claves.length; i++) {
        const result = await this.tryDecrypt(encrypted, this.claves[i]);
        if (result !== null) {
          console.log(`🔓 Mensaje desencriptado exitosamente con la clave ${i + 1}`);
          return result;
        }
      }

      throw new Error('No se pudo desencriptar el mensaje con ninguna de las claves disponibles');
    })());
  }

  cleanRawData(rawData: string): any {
    return this._jsonCleaner.cleanRawData(rawData);
  }

  async readJsonFile(file: File): Promise<any> {
    try {
      const cleanedData = await this._jsonCleaner.readJsonFile(file);

      // Si los datos son un array, procesarlos directamente
      if (Array.isArray(cleanedData)) {
        return cleanedData;
      }

      // Si es un objeto individual, envolverlo en un array
      return [cleanedData];
    } catch (error) {
      console.error('Error al procesar el archivo:', error);
      throw new Error('Error al procesar el archivo JSON: ' + (error as any).message);
    }
  }

  validateBeforeEncrypt(data: any): boolean {
    try {
      // Convertir a string si es un objeto
      const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
      return this._jsonCleaner.isValidJson(jsonStr);
    } catch (error) {
      return false;
    }
  }


  exportToExcel(encryptedData: string[]): void {
    try {
      const worksheetData = encryptedData.map((data, index) => ({
        index: index + 1,
        encrypted_data: data
      }));

      const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(worksheetData);

      // Ajustar el ancho de las columnas
      const maxWidth = Math.max(...encryptedData.map(d => d.length));
      worksheet['!cols'] = [
        { wch: 10 },  // Index column
        { wch: Math.min(maxWidth, 255) }  // Encrypted data column
      ];

      const workbook: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Encrypted Data');

      // Generar el archivo Excel con timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      XLSX.writeFile(workbook, `encrypted_data_${timestamp}.xlsx`);
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      throw new Error('Error al generar el archivo Excel');
    }
  }
}
