import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequesterEditComponent } from './requester-edit.component';

describe('RequesterEditComponent', () => {
  let component: RequesterEditComponent;
  let fixture: ComponentFixture<RequesterEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequesterEditComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RequesterEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
