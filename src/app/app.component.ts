import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { EncryptionService } from './shared/services/encryption.service';
import * as packageJson from './../../package.json';
import { HeaderComponent } from "./modules/decrypt/views/header/header.component";
import { EncryptAreaComponent } from "./modules/decrypt/views/encrypt-area/encrypt-area.component";
import { DecryptAreaComponent } from "./modules/decrypt/views/decrypt-area/decrypt-area.component";
import { MaterialModule } from './shared/material.module';

@Component({
    selector: 'app-root',
    imports: [CommonModule, MaterialModule, ReactiveFormsModule, HeaderComponent, DecryptAreaComponent, EncryptAreaComponent],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public title = 'Decrypted';
  public dataDesencriptada: any;
  public showEncryptArea = false;
  public copiado: boolean = false;
  public version = packageJson.version;
  public encryptedCode = new FormControl('');
  public currentYear = new Date().getFullYear();

  private _timeoutId: any;
  private _encryptionSrv = inject(EncryptionService);

  showEncrypt() {
    this.title = 'Encrypted';
    this.showEncryptArea = true;
  }

  showDecrypt() {
    this.title = 'Decrypted';
    this.showEncryptArea = false;
  }

  limpiar() {
    this.encryptedCode.reset();
    this.dataDesencriptada = '';
  }

  copiarResultado() {
    const texto = JSON.stringify(this.dataDesencriptada, null, 2);
    navigator.clipboard.writeText(texto).then(() => {
      this.copiado = true;

      // Limpiar cualquier timeout existente
      if (this._timeoutId) {
        clearTimeout(this._timeoutId);
      }

      // Restaurar el icono después de 2 segundos
      this._timeoutId = setTimeout(() => {
        this.copiado = false;
      }, 2000);
    });
  }

  desencriptar() {
    const code = this.encryptedCode.value;
    if (code) {
      const encryptedData = this.extractEncryptedCode(code);

      if (encryptedData) {
        this._encryptionSrv.decryptMessage(encryptedData).subscribe(
          (data) => {
            this.dataDesencriptada = data;
          },
          (error) => {
            console.error('Error al desencriptar:', error);
            this.dataDesencriptada = { error: 'No se pudo desencriptar el mensaje' };
          }
        );
      } else {
        console.error('No se encontró un código encriptado válido');
        this.dataDesencriptada = { error: 'No se encontró un código encriptado válido' };
      }
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
