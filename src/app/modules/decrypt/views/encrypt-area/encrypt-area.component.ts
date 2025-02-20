import { CommonModule } from '@angular/common';
import { Component, inject, ViewChild, ElementRef, OnInit, AfterViewInit, HostListener } from '@angular/core';
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
  @ViewChild('dropZone') dropZone!: ElementRef;

  encryptForm!: FormGroup;
  rawFocused = false;
  encryptedFocused = false;
  version = packageJson.version;
  copiado: boolean = false;
  isProcessing: boolean = false;
  hasJsonError: boolean = false;
  jsonErrorMessage: string = '';
  isDragging: boolean = false;

  currentYear = new Date().getFullYear();

  private _timeoutId: any;
  private _fb = inject(FormBuilder);
  private _encryptionSrv = inject(EncryptionService);

  // Event listeners para drag & drop
  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isProcessing) {
      this.isDragging = true;
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  @HostListener('drop', ['$event'])
  async onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (this.isProcessing) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (this.isValidFileType(file)) {
        await this.handleFileUpload({ target: { files: [file] } });
      } else {
        this.hasJsonError = true;
        this.jsonErrorMessage = 'Invalid file type. Please use .json or .txt files only.';
      }
    }
  }

  ngOnInit() {
    this.encryptForm = this._fb.group({
      rawText: [''],
      encryptedText: ['']
    });

    this.encryptForm.get('encryptedText')?.valueChanges.subscribe(() => {
      setTimeout(() => this.adjustTextareaHeight(), 0);
    });

    // Validación de JSON en tiempo real
    this.encryptForm.get('rawText')?.valueChanges.subscribe(value => {
      if (value) {
        try {
          const processedData = this.processInputData(value);
          this.hasJsonError = false;
          this.jsonErrorMessage = '';
          // Actualizar campo con JSON procesado
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

  private isValidFileType(file: File): boolean {
    const validTypes = ['.json', '.txt'];
    return validTypes.some(type => file.name.toLowerCase().endsWith(type));
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
      // Primero intentar parsear como array JSON
      const trimmedInput = input.trim();
      if (trimmedInput.startsWith('[') && trimmedInput.endsWith(']')) {
        return JSON.parse(trimmedInput);
      }

      // Si no es array, procesar como objetos múltiples
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
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    for (const line of lines) {
      try {
        // Validar que la línea es un objeto JSON
        if (line.startsWith('{') && line.endsWith('}')) {
          const parsed = JSON.parse(line);
          if (typeof parsed === 'object' && parsed !== null) {
            objects.push(parsed);
          }
        } else {
          // Intentar reparar el objeto si es necesario
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
      }
    }

    if (objects.length === 0) {
      throw new Error('No valid JSON objects found in the input');
    }

    return objects;
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const cleanContent = content
            .replace(/^\uFEFF/, '')     // Eliminar BOM
            .replace(/\r\n/g, '\n')     // Normalizar saltos de línea Windows
            .replace(/\r/g, '\n');      // Normalizar saltos de línea Mac
          resolve(cleanContent);
        } catch (error) {
          reject(new Error('Error cleaning file content'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
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

        this.encryptForm.patchValue({
          rawText: JSON.stringify(processedData, null, 2)
        });

        this.processDataForEncryption(processedData);
      } catch (error: any) {
        console.error('Error processing file:', error);
        this.hasJsonError = true;
        this.jsonErrorMessage = error.message || 'Error processing JSON file';
        this.encryptForm.patchValue({
          encryptedText: this.jsonErrorMessage
        });
        this.isProcessing = false;
      }
    }
  }

  private processDataForEncryption(data: any) {
    const dataToProcess = Array.isArray(data) ? data : [data];

    // Validar objetos antes de procesar
    const validData = dataToProcess.filter(item => {
      return typeof item === 'object' &&
        item !== null &&
        Object.keys(item).length > 0;
    });

    if (validData.length === 0) {
      this.hasJsonError = true;
      this.jsonErrorMessage = 'No valid data found to process';
      this.isProcessing = false;
      return;
    }

    console.log(`Processing ${validData.length} valid objects`);

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
        console.error('Encryption error:', error);
        this.hasJsonError = true;
        this.jsonErrorMessage = error.message || 'Encryption process error';
        this.encryptForm.patchValue({
          encryptedText: this.jsonErrorMessage
        });
        this.isProcessing = false;
      }
    });
  }

  onDropZoneClick(): void {
    if (!this.isProcessing) {
      this.fileInput.nativeElement.click();
    }
  }

  onPaste(event: ClipboardEvent) {
    const clipboardData = event.clipboardData?.getData('text');
    if (clipboardData) {
      try {
        const processedData = this.processInputData(clipboardData);
        this.encryptForm.patchValue({
          rawText: JSON.stringify(processedData, null, 2)
        });
      } catch (error) {
        // El manejo de errores existente se ocupará de esto
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

  encrypt() {
    if (this.hasJsonError) {
      return;
    }

    this.isProcessing = true;
    const text = this.encryptForm.get('rawText')?.value;

    if (text) {
      try {
        const processedData = this.processInputData(text);
        this.processDataForEncryption(processedData);
      } catch (error: any) {
        this.hasJsonError = true;
        this.jsonErrorMessage = error.message || 'Error processing JSON';
        this.encryptForm.patchValue({
          encryptedText: this.jsonErrorMessage
        });
        this.isProcessing = false;
      }
    }
  }
}
