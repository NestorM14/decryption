import { CommonModule } from '@angular/common';
import { Component, inject, ViewChild, ElementRef, OnInit, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../shared/material.module';
import * as packageJson from './../../../../../../package.json';
import { EncryptionService } from '../../../../shared/services/encryption.service';

@Component({
  selector: 'app-encrypt-area',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, FormsModule],
  templateUrl: './encrypt-area.component.html',
  styleUrl: './encrypt-area.component.scss'
})
export class EncryptAreaComponent implements OnInit, AfterViewInit {
  @ViewChild('preContent') preContent!: ElementRef;
  @ViewChild('encryptedTextarea') encryptedTextarea!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;

  encryptForm!: FormGroup;
  rawFocused = false;
  encryptedFocused = false;
  version = packageJson.version;
  copiado: boolean = false;
  isProcessing: boolean = false;
  hasJsonError: boolean = false;
  jsonErrorMessage: string = '';

  currentYear = new Date().getFullYear();

  private _timeoutId: any;
  private _fb = inject(FormBuilder);
  private _encryptionSrv = inject(EncryptionService);

  ngOnInit() {
    this.encryptForm = this._fb.group({
      rawText: [''],
      encryptedText: ['']
    });

    this.encryptForm.get('encryptedText')?.valueChanges.subscribe(() => {
      setTimeout(() => this.adjustTextareaHeight(), 0);
    });

    // Real-time JSON validation
    this.encryptForm.get('rawText')?.valueChanges.subscribe(value => {
      if (value) {
        try {
          const processedData = this.processInputData(value);
          this.hasJsonError = false;
          this.jsonErrorMessage = '';
          // Update field with cleaned JSON
          this.encryptForm.patchValue({
            rawText: JSON.stringify(processedData, null, 2)
          }, { emitEvent: false });
        } catch (error: any) {
          this.hasJsonError = true;
          this.jsonErrorMessage = error.message || 'Invalid JSON';
        }
      } else {
        this.hasJsonError = false;
        this.jsonErrorMessage = '';
      }
    });
  }

  ngAfterViewInit() {
    if (this.encryptForm.get('encryptedText')?.value) {
      this.adjustTextareaHeight();
    }
  }

  private adjustTextareaHeight() {
    if (this.preContent && this.encryptedTextarea) {
      const content = this.preContent.nativeElement;
      const textarea = this.encryptedTextarea.nativeElement;
      const contentHeight = content.scrollHeight;
      const maxHeight = window.innerHeight - 300;
      const finalHeight = Math.min(Math.max(360, contentHeight), maxHeight);
      textarea.style.height = `${finalHeight}px`;
    }
  }

  clearForm() {
    this.encryptForm.reset();
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    this.hasJsonError = false;
    this.jsonErrorMessage = '';
  }

  private processInputData(input: string): any {
    try {
      // Primero intentar parsear como un array JSON válido
      const trimmedInput = input.trim();
      if (trimmedInput.startsWith('[') && trimmedInput.endsWith(']')) {
        return JSON.parse(trimmedInput);
      }

      // Si no es un array, intentar procesar como objetos múltiples
      return this.parseMultipleObjects(input);
    } catch (e) {
      console.error('Error processing input:', e);
      throw new Error('Invalid JSON format');
    }
  }

  private parseMultipleObjects(input: string): any[] {
    const objects: any[] = [];

    // Dividir por saltos de línea y limpiar líneas vacías
    const lines = input
      .split(/\r?\n/)                    // Dividir por cualquier tipo de salto de línea
      .map(line => line.trim())          // Limpiar espacios
      .filter(line => line.length > 0);   // Eliminar líneas vacías

    for (const line of lines) {
      try {
        // Validar que la línea parece un objeto JSON
        if (line.startsWith('{') && line.endsWith('}')) {
          const parsed = JSON.parse(line);
          if (typeof parsed === 'object' && parsed !== null) {
            objects.push(parsed);
          }
        } else {
          // Intentar reparar el objeto si no está bien formado
          let fixedLine = line;
          if (!fixedLine.startsWith('{')) fixedLine = '{' + fixedLine;
          if (!fixedLine.endsWith('}')) fixedLine = fixedLine + '}';

          const parsed = JSON.parse(fixedLine);
          if (typeof parsed === 'object' && parsed !== null) {
            objects.push(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to parse line:', line);
        // Continuar con la siguiente línea en caso de error
      }
    }

    if (objects.length === 0) {
      throw new Error('No se encontraron objetos JSON válidos en el archivo');
    }

    return objects;
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          // Limpiar BOM y otros caracteres especiales
          const cleanContent = content
            .replace(/^\uFEFF/, '')     // Eliminar BOM
            .replace(/\r\n/g, '\n')     // Normalizar saltos de línea Windows
            .replace(/\r/g, '\n');      // Normalizar saltos de línea Mac
          resolve(cleanContent);
        } catch (error) {
          reject(new Error('Error al limpiar el contenido del archivo'));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsText(file);
    });
  }

  async handleFileUpload(event: any) {
    this.isProcessing = true;
    this.hasJsonError = false;
    this.jsonErrorMessage = '';

    const file = event.target.files[0];
    if (file) {
      try {
        const fileContent = await this.readFileContent(file);
        const processedData = this.processInputData(fileContent);

        // Mostrar en el área de texto raw los datos procesados
        this.encryptForm.patchValue({
          rawText: JSON.stringify(processedData, null, 2)
        });

        // Procesar para encriptación
        this.processDataForEncryption(processedData);
      } catch (error: any) {
        console.error('Error al procesar el archivo:', error);
        this.hasJsonError = true;
        this.jsonErrorMessage = error.message || 'Error al procesar el archivo JSON';
        this.encryptForm.patchValue({
          encryptedText: this.jsonErrorMessage
        });
        this.isProcessing = false;
      }
    }
  }

  private processDataForEncryption(data: any) {
    // Asegurar que data sea siempre un array
    const dataToProcess = Array.isArray(data) ? data : [data];

    // Filtrar objetos válidos
    const validData = dataToProcess.filter(item => {
      return typeof item === 'object' &&
          item !== null &&
          Object.keys(item).length > 0;
    });

    if (validData.length === 0) {
      this.hasJsonError = true;
      this.jsonErrorMessage = 'No se encontraron datos válidos para procesar';
      this.isProcessing = false;
      return;
    }

    // Mostrar información de procesamiento
    console.log(`Procesando ${validData.length} objetos válidos`);

    this._encryptionSrv.encryptBulk(validData).subscribe({
      next: (encryptedDataArray) => {
        // Exportar a Excel
        this._encryptionSrv.exportToExcel(encryptedDataArray);

        // Mostrar en textarea
        this.encryptForm.patchValue({
          encryptedText: JSON.stringify(encryptedDataArray, null, 2)
        });
        this.isProcessing = false;
      },
      error: (error) => {
        console.error('Error en la encriptación:', error);
        this.hasJsonError = true;
        this.jsonErrorMessage = error.message || 'Error en el proceso de encriptación';
        this.encryptForm.patchValue({
          encryptedText: this.jsonErrorMessage
        });
        this.isProcessing = false;
      }
    });
  }

  encrypt() {
    if (this.hasJsonError) {
      return;
    }

    this.isProcessing = true;
    const text = this.encryptForm.get('rawText')?.value;

    if (text) {
      try {
        // Usar el servicio de limpieza antes de procesar
        const cleanedData = this._encryptionSrv.cleanRawData(text);
        this.processDataForEncryption(cleanedData);
      } catch (error: any) {
        this.hasJsonError = true;
        this.jsonErrorMessage = error.message || 'Error al procesar el JSON';
        this.encryptForm.patchValue({
          encryptedText: this.jsonErrorMessage
        });
        this.isProcessing = false;
      }
    }
  }

  copyToClipboard() {
    const encryptedText = this.encryptForm.get('encryptedText')?.value;
    if (encryptedText) {
      navigator.clipboard.writeText(encryptedText).then(() => {
        this.copiado = true;
        if (this._timeoutId) clearTimeout(this._timeoutId);
        this._timeoutId = setTimeout(() => this.copiado = false, 2000);
      });
    }
  }
}
