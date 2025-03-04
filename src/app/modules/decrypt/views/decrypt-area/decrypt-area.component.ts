import { CommonModule } from '@angular/common';
import { Component, inject, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../shared/material.module';
import * as packageJson from './../../../../../../package.json';
import { EncryptionService } from '../../../../shared/services/encryption.service';
import { NgxJsonViewerModule } from 'ngx-json-viewer';

@Component({
  selector: 'app-decrypt-area',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, FormsModule, NgxJsonViewerModule],
  templateUrl: './decrypt-area.component.html',
  styleUrl: './decrypt-area.component.scss'
})
export class DecryptAreaComponent implements OnInit, AfterViewInit {
  @ViewChild('preContent') preContent!: ElementRef;
  @ViewChild('decryptedTextarea') decryptedTextarea!: ElementRef;

  decryptForm!: FormGroup;
  encryptedFocused = false;
  decryptedFocused = false;
  parsedJsonData: any = null;
  showJsonViewer = false;
  version = packageJson.version;
  copiado: boolean = false;
  isProcessing: boolean = false;
  hasError: boolean = false;
  errorMessage: string = '';

  encryptedCode = new FormControl('');
  currentYear = new Date().getFullYear();

  private _timeoutId: any;
  private _fb = inject(FormBuilder);
  private _encryptionSrv = inject(EncryptionService);

  ngOnInit() {
    this.decryptForm = this._fb.group({
      encryptedCode: [''],
      decryptedCode: ['']
    });

    this.decryptForm.get('decryptedCode')?.valueChanges.subscribe(() => {
      setTimeout(() => this.adjustTextareaHeight(), 0);
    });
  }

  ngAfterViewInit() {
    if (this.decryptForm.get('decryptedCode')?.value) {
      this.adjustTextareaHeight();
    }

    // Aplicar estilos programáticamente para asegurarnos que se aplican correctamente
    setTimeout(() => {
      this.applyJsonViewerStyles();
    }, 0);
  }

  adjustTextareaHeight(): void {
    if (!this.showJsonViewer) {
      if (this.decryptedTextarea && this.decryptedTextarea.nativeElement) {
        const textarea = this.decryptedTextarea.nativeElement;

        // Calculamos la altura basada en el contenido
        textarea.style.height = '360px'; // Altura inicial fija

        // Solo ajustamos si el contenido es mayor que la altura inicial
        if (textarea.scrollHeight > 360) {
          const maxHeight = window.innerHeight - 350;
          const finalHeight = Math.min(textarea.scrollHeight, maxHeight);
          textarea.style.height = `${finalHeight}px`;
        }
      }
    }
  }

  clearForm() {
    this.decryptForm.reset();
    this.parsedJsonData = null;
    this.showJsonViewer = false;
    this.hasError = false;
    this.errorMessage = '';
  }

  decrypt() {
    const code = this.decryptForm.get('encryptedCode')?.value;
    if (code) {
      this.isProcessing = true;
      this.hasError = false;
      this.errorMessage = '';
      this.showJsonViewer = false;
      this.parsedJsonData = null;

      const encryptedData = this.extractEncryptedCode(code);

      if (encryptedData) {
        this._encryptionSrv.decryptMessage(encryptedData).subscribe({
          next: (data) => {
            this.parsedJsonData = data;
            this.showJsonViewer = true;

            const formattedData = JSON.stringify(data, null, 2);
            this.decryptForm.patchValue({ decryptedCode: formattedData });

            this.isProcessing = false;

            // Asegurar que los estilos se apliquen después de que el JSON viewer se renderice
            setTimeout(() => {
              this.applyJsonViewerStyles();
            }, 100);
          },
          error: (error) => {
            console.error('Error al desencriptar:', error);
            this.hasError = true;
            this.errorMessage = 'No se pudo desencriptar el mensaje';
            this.parsedJsonData = { error: this.errorMessage };
            this.showJsonViewer = true;

            this.decryptForm.patchValue({
              decryptedCode: JSON.stringify({ error: this.errorMessage }, null, 2)
            });
            this.isProcessing = false;
          }
        });
      } else {
        this.hasError = true;
        this.errorMessage = 'No se encontró un código encriptado válido';
        this.parsedJsonData = { error: this.errorMessage };
        this.showJsonViewer = true;

        this.decryptForm.patchValue({
          decryptedCode: JSON.stringify({ error: this.errorMessage }, null, 2)
        });
        this.isProcessing = false;
      }
    }
  }

  copyToClipboard() {
    const decryptedCode = this.decryptForm.get('decryptedCode')?.value;
    if (decryptedCode) {
      navigator.clipboard.writeText(decryptedCode).then(() => {
        this.copiado = true;
        if (this._timeoutId) clearTimeout(this._timeoutId);
        this._timeoutId = setTimeout(() => this.copiado = false, 2000);
      });
    }
  }

  private extractEncryptedCode(input: string): string | null {
    const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    const cleanedInput = input.replace(/\s/g, '');
    const matches = cleanedInput.match(/[A-Za-z0-9+/=]+/g);

    if (matches) {
      const sortedMatches = matches.sort((a, b) => b.length - a.length);
      for (const match of sortedMatches) {
        if (base64Regex.test(match)) {
          return match;
        }
      }
    }
    return null;
  }

  // Ajustar el método para aplicar estilos programáticamente
  applyJsonViewerStyles() {
    // Primero aplicamos estilos globales
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .ngx-json-viewer .segment-value.string {
        color: #4EC9B0 !important;
        background-color: transparent !important;
      }
      .ngx-json-viewer .segment-key {
        color: #61dafe !important;
      }
      .ngx-json-viewer .segment-value.number {
        color: #85cc5e !important;
        background-color: transparent !important;
      }
      .ngx-json-viewer .segment-value.boolean {
        color: #569cd6 !important;
        background-color: transparent !important;
      }
      .ngx-json-viewer .segment-value.date {
        color: #c586c0 !important;
        background-color: transparent !important;
      }
      .ngx-json-viewer .segment-value.null {
        color: #808080 !important;
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(styleElement);

    // Luego intentamos aplicar estilos directamente en el elemento
    setTimeout(() => {
      const jsonViewer = document.getElementById('json-viewer-element');
      if (jsonViewer) {
        // Seleccionar todos los elementos .string dentro del visualizador
        const stringElements = jsonViewer.querySelectorAll('.segment-value.string');
        stringElements.forEach(element => {
          (element as HTMLElement).style.color = '#4EC9B0';
          (element as HTMLElement).style.backgroundColor = 'transparent';
        });

        // Aplicar estilos a otros elementos si es necesario
        jsonViewer.querySelectorAll('.segment-key').forEach(element => {
          (element as HTMLElement).style.color = '#61dafe';
        });
      }
    }, 200);
  }
}
