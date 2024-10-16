import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Component, inject } from '@angular/core';
import { EncryptionService } from './shared/services/encryption.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'Decrypted';
  dataDesencriptada: any;
  encryptedCode = new FormControl("");
  private encryptionService = inject(EncryptionService);

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
    // Expresión regular para encontrar una cadena base64 válida
    const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

    // Eliminar cualquier espacio en blanco, saltos de línea y caracteres no deseados
    const cleanedInput = input.replace(/\s/g, '');

    // Buscar la cadena más larga que coincida con el patrón base64
    const matches = cleanedInput.match(/[A-Za-z0-9+/=]+/g);

    if (matches) {
      // Ordenar las coincidencias por longitud, de más larga a más corta
      const sortedMatches = matches.sort((a, b) => b.length - a.length);

      // Encontrar la primera coincidencia que sea una cadena base64 válida
      for (const match of sortedMatches) {
        if (base64Regex.test(match)) {
          return match;
        }
      }
    }

    return null;
  }
}
