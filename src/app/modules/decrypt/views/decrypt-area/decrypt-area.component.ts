import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../shared/material.module';
import { MatSnackBar } from '@angular/material/snack-bar';

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

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.decryptForm = this.fb.group({
      encryptedCode: [''],
      decryptedCode: ['']
    });
  }

  clearForm() {
    this.decryptForm.reset();
  }

  decrypt() {
    // Implementar lógica de desencriptación
  }

  copyToClipboard() {
    const decryptedCode = this.decryptForm.get('decryptedCode')?.value;
    navigator.clipboard.writeText(decryptedCode).then(() => {
      this.snackBar.open('Code copied to clipboard', 'Close', {
        duration: 2000,
      });
    });
  }
}
