import { TestBed } from '@angular/core/testing';

import { Ws } from './ws';

describe('Ws', () => {
  let service: Ws;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Ws);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
