import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { EncryptionService } from './shared/services/encryption.service';
import * as packageJson from './../../package.json';
import { DecryptAreaComponent } from "./modules/decrypt/views/decrypt-area/decrypt-area.component";
import { HeaderComponent } from "./modules/decrypt/views/header/header.component";

@Component({
    selector: 'app-root',
    imports: [CommonModule, ReactiveFormsModule, HeaderComponent, DecryptAreaComponent],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Decrypted';
  dataDesencriptada: any;
  version = packageJson.version;
  encryptedCode = new FormControl('');
  copiado: boolean = false;
  private timeoutId: any;
  private encryptionService = inject(EncryptionService);

  limpiar() {
    this.encryptedCode.reset();
    this.dataDesencriptada = '';
  }

  copiarResultado() {
    const texto = JSON.stringify(this.dataDesencriptada, null, 2);
    navigator.clipboard.writeText(texto).then(() => {
      this.copiado = true;

      // Limpiar cualquier timeout existente
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }

      // Restaurar el icono después de 2 segundos
      this.timeoutId = setTimeout(() => {
        this.copiado = false;
      }, 2000);
    });
  }

  desencriptar() {
    const code = this.encryptedCode.value;
    if (code) {
      const encryptedData = this.extractEncryptedCode(code);

      if (encryptedData) {
        this.encryptionService.decryptMessage(encryptedData).subscribe(
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
