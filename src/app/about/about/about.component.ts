import { Component } from '@angular/core';
import { TopMenuComponent } from '../../misc/topMenu/top-menu/top-menu.component';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { CardComponent } from '../../misc/cards/card/card.component';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [TopMenuComponent, NzModalModule, CommonModule, NzButtonModule, CardComponent,  NzCardModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css'
})
export class AboutComponent {
  isVisible = false;

  constructor() {}

  showModal(): void {
    this.isVisible = true;
  }

  handleOk(): void {
    console.log('Button ok clicked!');
    this.isVisible = false;
  }

  handleCancel(): void {
    console.log('Button cancel clicked!');
    this.isVisible = false;
  }
}
