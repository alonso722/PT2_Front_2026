import { Component } from '@angular/core';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-top-menu',
  standalone: true,
  imports: [NzMenuModule, RouterModule],
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.css']
})
export class TopMenuComponent {

}
