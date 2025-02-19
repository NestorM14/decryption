import { Injectable } from '@angular/core';
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

    return from((async () => {
      const encryptedData: string[] = [];

      for (const item of data) {
        try {
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

          encryptedData.push(btoa(String.fromCharCode(...result)));
          console.log('✅ ', this.count, 'Encrypted Item');
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

  cleanRawData(rawData: string): any[] {
    try {
      // Primero intentamos ver si ya es un JSON válido
      try {
        const parsed = JSON.parse(rawData);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Si no es un JSON válido, continuamos con la limpieza
      }

      // Separar por líneas y limpiar
      const lines = rawData.split('\n');
      const cleanedObjects = [];
      let currentObject: any = null;

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Limpiar caracteres especiales y formato
        line = line
          .replace(/\\"/g, '"')     // Reemplazar \" por "
          .replace(/^"/, '')        // Eliminar comillas del inicio
          .replace(/"$/, '')        // Eliminar comillas del final
          .replace(/""/g, '"')      // Reemplazar "" por "
          .replace(/";/g, '",')     // Reemplazar "; por ",
          .replace(/\s+/g, ' ')     // Normalizar espacios
          .trim();

        // Si la línea comienza con { es un nuevo objeto
        if (line.startsWith('{')) {
          currentObject = {};
          const clientMatch = line.match(/"client"\s*:\s*{/);
          if (clientMatch) {
            currentObject.client = {};
          }
        }

        // Extraer pares clave-valor
        const matches = line.match(/"([^"]+)"\s*:\s*"([^"]+)"/g);
        if (matches && currentObject?.client) {
          matches.forEach(match => {
            const [key, value] = match.split(':').map(part =>
              part.trim().replace(/^"|"$/g, '')
            );
            currentObject.client[key] = value;
          });
        }

        // Si la línea termina con }, el objeto está completo
        if (line.endsWith('}') && currentObject) {
          if (Object.keys(currentObject.client || {}).length > 0) {
            cleanedObjects.push(currentObject);
          }
          currentObject = null;
        }
      }

      // Validar y completar los objetos
      return cleanedObjects.map((obj, index) => {
        if (!obj.client) {
          obj.client = {};
        }

        // Asegurar que todos los campos requeridos estén presentes
        const clientNum = 2000 + index;
        const defaultClient = {
          identificationType: "Passport",
          email: `cargaystresstbQA${clientNum}@yopmail.com`,
          firstName: `cargaystress${clientNum}`,
          middleName: `ONB${index + 1}`,
          lastName1: `ACT DATOS${index + 1}`,
          lastName2: `CARGAVASS${index + 1}`,
          dateOfBirth: "1979-05-24",
          idExpirationDate: "2029-05-31",
          gender: 1,
          nationality: 591,
          placeOfBirth: 591,
          phoneNumCode: "PA",
          phoneNumber: "3121212"
        };

        // Mantener los valores existentes y completar los que faltan
        obj.client = {
          ...defaultClient,
          ...obj.client
        };

        return obj;
      });
    } catch (error) {
      console.error('Error limpiando datos:', error);
      throw new Error('Error al procesar el JSON');
    }
  }

  async readJsonFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: any) => {
        try {
          const text = e.target.result;
          const cleanedData = this.cleanRawData(text);
          resolve(cleanedData);
        } catch (error) {
          console.error('Error processing file:', error);
          reject(new Error('Error al procesar el archivo JSON'));
        }
      };

      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        reject(new Error('Error al leer el archivo'));
      };

      reader.readAsText(file);
    });
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
