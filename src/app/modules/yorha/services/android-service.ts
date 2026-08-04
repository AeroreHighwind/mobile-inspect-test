import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Android, ANDROIDS } from '../data/android-models';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AndroidService {
  private readonly _http = inject(HttpClient);
  private readonly _androids = ANDROIDS;
  private _activeFile: number = 0;

  public getAndroidById(id: number): Observable<Android> {
    return this._http.get<Android>(`data/androids/${id}.json`)
      .pipe( tap((a)=> this._activeFile = a.id) );
  }

  public getAndroids(): Observable<Android[]> {
    return this._http.get<Android[]>(`data/androids/androids.json`)
  }

  public getNextAndroid(): Observable<Android> {
    this._activeFile > 4 ? this._activeFile = 1 : this._activeFile ++;
    const id = this._activeFile
    return this.getAndroidById(id);
  }

    public getPreviousAndroid(): Observable<Android> {
    this._activeFile > 1 ? this._activeFile -- : this._activeFile = 5;
    const id = this._activeFile;
    return this.getAndroidById(id);
  }
}
