import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../shared/material.module';
import * as packageJson from './../../../../../../package.json';
import { EncryptionService } from '../../../../shared/services/encryption.service';

@Component({
  selector: 'app-decrypt-area',
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, FormsModule],
  templateUrl: './decrypt-area.component.html',
  styleUrl: './decrypt-area.component.scss'
})
export class DecryptAreaComponent {
  decryptForm!: FormGroup;
  encryptedFocused = false;
  decryptedFocused = false;
  dataDesencriptada: any;
  version = packageJson.version;
  copiado: boolean = false;

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
  }

  clearForm() {
    this.decryptForm.reset();
    this.dataDesencriptada = '';
  }

  decrypt() {
    const code = this.decryptForm.get('encryptedCode')?.value;
    if (code) {
      const encryptedData = this.extractEncryptedCode(code);

      if (encryptedData) {
        this._encryptionSrv.decryptMessage(encryptedData).subscribe({
          next: (data) => {
            const formattedData = JSON.stringify(data, null, 2);
            this.decryptForm.patchValue({ decryptedCode: formattedData });
          },
          error: (error) => {
            console.error('Error al desencriptar:', error);
            this.decryptForm.patchValue({
              decryptedCode: JSON.stringify({ error: 'No se pudo desencriptar el mensaje' }, null, 2)
            });
          }
        });
      } else {
        this.decryptForm.patchValue({
          decryptedCode: JSON.stringify({ error: 'No se encontró un código encriptado válido' }, null, 2)
        });
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
}
