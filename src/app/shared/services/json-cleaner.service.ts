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
      const parsed = JSON.parse(rawData);
      return parsed;
    } catch (e) {
      console.log('JSON inicial inválido, intentando limpiar...');
    }

    // Preparación inicial del texto
    let cleanedData = this.preProcessText(rawData);

    // Intentar parsear después de la limpieza inicial
    try {
      return JSON.parse(cleanedData);
    } catch (e) {
      console.log('Limpieza inicial insuficiente, aplicando correcciones avanzadas...');
    }

    // Dividir el contenido en bloques de objetos potenciales
    const blocks = this.splitIntoBlocks(cleanedData);

    // Procesar cada bloque
    const processedBlocks = blocks.map(block => {
      try {
        return this.processBlock(block);
      } catch (e) {
        console.warn('Error processing block:', block, e);
        return null;
      }
    }).filter(block => block !== null);

    if (processedBlocks.length === 0) {
      // Intento final con limpieza agresiva
      const aggressiveCleaning = this.aggressiveCleaning(cleanedData);
      try {
        return JSON.parse(aggressiveCleaning);
      } catch (e) {
        throw new Error('No se encontraron objetos JSON válidos después de la limpieza agresiva');
      }
    }

    return processedBlocks.length === 1 ? processedBlocks[0] : processedBlocks;

  } catch (error: any) {
    console.error('Error en la limpieza del JSON:', error);
    throw new Error('Error al procesar el JSON: ' + error.message);
  }
  }

  /**
   * Pre-procesa el texto para eliminar caracteres problemáticos
   */
  private preProcessText(text: string): string {
    return text
      .trim()
      .replace(/^\uFEFF/, '') // Eliminar BOM
      .replace(/[\u0000-\u0019]+/g, ' ') // Eliminar caracteres de control
      .replace(/\r?\n/g, ' ') // Convertir saltos de línea en espacios
      .replace(/\s+/g, ' ') // Normalizar espacios
      .replace(/\\([^"\\\/bfnrtu])/g, '$1'); // Eliminar escapes innecesarios
  }

  /**
   * Divide el texto en bloques potenciales de JSON
   */
  private splitIntoBlocks(text: string): string[] {
    // Primero intentar dividir por objetos JSON completos
    const objectMatches = text.match(/\{[^{}]*\}/g) || [];
    if (objectMatches.length > 0) {
      return objectMatches;
    }

    // Si no hay coincidencias, intentar dividir por delimitadores comunes
    return text
      .split(/}[\s,]*{/)
      .map((part, index, array) => {
        let processed = part.trim();
        if (index > 0) processed = '{' + processed;
        if (index < array.length - 1) processed = processed + '}';
        return processed;
      });
  }

  /**
   * Procesa un bloque individual de texto
   */
  private processBlock(block: string): any {
    // Primera limpieza básica
    let processed = block
      .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2": ') // Fix property names
      .replace(/:\s*'([^']+)'/g, ':"$1"') // Fix single quoted values
      .replace(/:\s*([^",}\s]+)([,}])/g, ':"$1"$2') // Add quotes to unquoted values
      .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
      .replace(/,+/g, ',') // Fix multiple commas
      .trim();

    // Corrección especial para propiedades pegadas
    processed = this.fixStuckProperties(processed);

    // Asegurar estructura de objeto
    if (!processed.startsWith('{')) processed = '{' + processed;
    if (!processed.endsWith('}')) processed = processed + '}';

    try {
      return JSON.parse(processed);
    } catch (e) {
      // Limpieza más agresiva si falla el primer intento
      processed = this.deepClean(processed);
      return JSON.parse(processed);
    }
  }

  /**
   * Corrige propiedades pegadas (ej: "prop1""prop2")
   */
  private fixStuckProperties(text: string): string {
    return text
      .replace(/"([^"]+)"(?=")/g, '"$1",') // Fix stuck properties
      .replace(/""([^"]+)"/g, '","$1"') // Fix double quotes
      .replace(/"([^"]+)""([^"]+)"/g, '"$1","$2"') // Fix multiple stuck properties
      .replace(/(["}])([^,{\s])/g, '$1,$2'); // Add missing commas
  }

  /**
   * Limpieza profunda para casos problemáticos
   */
  private deepClean(text: string): string {
    return text
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3') // Force quote property names
      .replace(/:\s*([^",}\s\[\]]+)([,}])/g, ':"$1"$2') // Force quote values
      .replace(/,\s*,/g, ',') // Fix multiple commas
      .replace(/,\s*}/g, '}') // Fix trailing comma
      .replace(/}\s*,\s*}/g, '}}') // Fix nested object endings
      .replace(/^\{\s*\{/, '{') // Fix double opening braces
      .replace(/}\s*}$/, '}') // Fix double closing braces
      .replace(/"\s*"/g, '","') // Fix adjacent quotes
      .replace(/\}\s*\{/g, '},{'); // Fix adjacent objects
  }

  /**
   * Limpieza agresiva como último recurso
   */
  private aggressiveCleaning(text: string): string {
    // Eliminar todo excepto caracteres básicos JSON
    let cleaned = text.replace(/[^{}[\]",:.\-\d\w\s]/g, '');

    // Intentar reconstruir la estructura JSON
    cleaned = cleaned
      .replace(/([{,])\s*([^"{\s])/g, '$1"$2') // Forzar comillas en propiedades
      .replace(/([^"}])\s*:/g, '$1":') // Forzar comillas en propiedades
      .replace(/:\s*([^",{\[\s])/g, ':"$1') // Forzar comillas en valores
      .replace(/([^"}]),/g, '$1",') // Cerrar comillas en valores
      .replace(/,\s*}/g, '}') // Eliminar comas finales
      .replace(/}\s*{/g, '},{') // Separar objetos
      .trim();

    // Asegurar estructura válida
    if (!cleaned.startsWith('{')) cleaned = '{' + cleaned;
    if (!cleaned.endsWith('}')) cleaned = cleaned + '}';

    return cleaned;
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
        } catch (error: any) {
          console.error('Error processing file:', error);
          reject(new Error('Error al procesar el archivo JSON: ' + error.message));
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
