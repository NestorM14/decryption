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
  }

  async handleFileUpload(event: any) {
    this.isProcessing = true;
    const file = event.target.files[0];
    if (file) {
      try {
        const jsonData = await this._encryptionSrv.readJsonFile(file);
        this.encryptForm.patchValue({
          rawText: JSON.stringify(jsonData, null, 2)
        });
      } catch (error) {
        console.error('Error al leer el archivo:', error);
        this.encryptForm.patchValue({
          encryptedText: 'Error al leer el archivo JSON'
        });
      } finally {
        this.isProcessing = false;
      }
    }
  }

  encrypt() {
    this.isProcessing = true;
    const text = this.encryptForm.get('rawText')?.value;

    if (text) {
      try {
        let jsonData = JSON.parse(text);

        // Si es un array, procesamos en bulk
        if (Array.isArray(jsonData)) {
          this._encryptionSrv.encryptBulk(jsonData).subscribe({
            next: (encryptedDataArray) => {
              // Exportar a Excel
              this._encryptionSrv.exportToExcel(encryptedDataArray);

              // Mostrar en el textarea
              this.encryptForm.patchValue({
                encryptedText: JSON.stringify(encryptedDataArray, null, 2)
              });
              this.isProcessing = false;
            },
            error: (error) => {
              console.error('Error al encriptar:', error);
              this.encryptForm.patchValue({
                encryptedText: 'Error al encriptar los datos'
              });
              this.isProcessing = false;
            }
          });
        } else {
          // Si es un objeto individual
          this._encryptionSrv.encryptMessage(jsonData).subscribe({
            next: (encryptedData) => {
              this.encryptForm.patchValue({ encryptedText: encryptedData });
              this.isProcessing = false;
            },
            error: (error) => {
              console.error('Error al encriptar:', error);
              this.encryptForm.patchValue({
                encryptedText: 'Error al encriptar el mensaje'
              });
              this.isProcessing = false;
            }
          });
        }
      } catch (e) {
        this.encryptForm.patchValue({
          encryptedText: 'El texto debe ser un JSON válido'
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
