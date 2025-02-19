import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class JsonCleanerService {

  /**
   * Limpia y corrige un string que debería ser JSON
   * @param rawData String que contiene el JSON potencialmente malformado
   * @returns JSON válido parseado
   */
  cleanRawData(rawData: string): any {
    try {
      // Primer intento: verificar si ya es un JSON válido
      try {
        return JSON.parse(rawData);
      } catch (e) {
        // Si falla, continuamos con la limpieza
        console.log('JSON inicial inválido, intentando limpiar...');
      }

      // Limpieza básica del string
      let cleanedData = rawData
        .trim()
        // Eliminar BOM y caracteres especiales
        .replace(/^\uFEFF/, '')
        .replace(/[\u0000-\u0019]+/g, ' ')
        // Corregir comillas
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2": ')
        // Asegurar que las comillas de los valores sean dobles
        .replace(/:\s*'([^']+)'/g, ':"$1"')
        // Eliminar comas extra al final de objetos y arrays
        .replace(/,(\s*[}\]])/g, '$1')
        // Asegurar que haya comas entre elementos
        .replace(/}(\s*){/g, '},{')
        .replace(/](\s*)\[/g, '],[')
        // Corregir espacios y saltos de línea extras
        .replace(/\s+/g, ' ')
        // Corregir objetos concatenados incorrectamente
        .replace(/}{/g, '},{')
        // Corregir arrays concatenados incorrectamente
        .replace(/\]\[/g, '],[');

      // Detectar si debería ser un array
      if (cleanedData.trim().startsWith('{') && cleanedData.includes('},{')) {
        cleanedData = `[${cleanedData}]`;
      }

      // Verificar si necesitamos envolver en array
      if (!cleanedData.startsWith('[') && !cleanedData.startsWith('{')) {
        cleanedData = `[${cleanedData}]`;
      }

      // Asegurar que los arrays y objetos estén bien cerrados
      const openBraces = (cleanedData.match(/{/g) || []).length;
      const closeBraces = (cleanedData.match(/}/g) || []).length;
      const openBrackets = (cleanedData.match(/\[/g) || []).length;
      const closeBrackets = (cleanedData.match(/\]/g) || []).length;

      // Añadir llaves o corchetes faltantes
      while (openBraces > closeBraces) {
        cleanedData += '}';
      }
      while (openBrackets > closeBrackets) {
        cleanedData += ']';
      }

      // Intentar parsear el resultado
      try {
        const parsed = JSON.parse(cleanedData);
        console.log('JSON limpiado y parseado exitosamente');
        return parsed;
      } catch (e: any) {
        // Si aún falla, intentar un último enfoque más agresivo
        console.log('Primer intento de limpieza falló, intentando corrección agresiva...');

        // Separar por posibles delimitadores comunes y reconstruir
        const parts = cleanedData
          .split(/(?<=})\s*(?={)/g)
          .map(part => part.trim())
          .filter(part => part.length > 0);

        if (parts.length > 1) {
          const arrayData = `[${parts.join(',')}]`;
          return JSON.parse(arrayData);
        }

        throw new Error('No se pudo corregir el JSON: ' + e.message);
      }
    } catch (error) {
      console.error('Error en la limpieza del JSON:', error);
      throw new Error('Error al procesar el JSON: ' + (error as any).message);
    }
  }

  /**
   * Lee y procesa un archivo que debería contener JSON
   * @param file Archivo a procesar
   * @returns Promise con el JSON parseado
   */
  async readJsonFile(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: any) => {
        try {
          const text = e.target.result;
          const cleanedData = this.cleanRawData(text);
          resolve(cleanedData);
        } catch (error) {
          console.error('Error processing file:', error);
          reject(new Error('Error al procesar el archivo JSON: ' + (error as any).message));
        }
      };

      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        reject(new Error('Error al leer el archivo'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Valida si un string es un JSON válido
   * @param str String a validar
   * @returns boolean indicando si es un JSON válido
   */
  isValidJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }
}
