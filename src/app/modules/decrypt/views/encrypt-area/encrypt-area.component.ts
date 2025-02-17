import { CommonModule } from '@angular/common';
import { Component, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
export class EncryptAreaComponent implements AfterViewInit {
  @ViewChild('preContent') preContent!: ElementRef;
  @ViewChild('encryptedTextarea') encryptedTextarea!: ElementRef;

  encryptForm!: FormGroup;
  rawFocused = false;
  encryptedFocused = false;
  version = packageJson.version;
  copiado: boolean = false;

  currentYear = new Date().getFullYear();

  private _timeoutId: any;

  private _fb = inject(FormBuilder);
  private _encryptionSrv = inject(EncryptionService);

  ngOnInit() {
    this.encryptForm = this._fb.group({
      rawText: [''],
      encryptedText: ['']
    });

    // Suscribirse a los cambios del campo encryptedText para ajustar altura
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
  }

  encrypt() {
    const text = this.encryptForm.get('rawText')?.value;
    if (text) {
      try {
        // Verificar que el texto es un JSON válido
        const jsonData = JSON.parse(text);

        this._encryptionSrv.encryptMessage(jsonData).subscribe({
          next: (encryptedData) => {
            this.encryptForm.patchValue({ encryptedText: encryptedData });
          },
          error: (error) => {
            console.error('Error al encriptar:', error);
            this.encryptForm.patchValue({
              encryptedText: 'Error al encriptar el mensaje'
            });
          }
        });
      } catch (e) {
        this.encryptForm.patchValue({
          encryptedText: 'El texto debe ser un JSON válido'
        });
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
