import fs from 'node:fs';
import path from 'node:path';
import { CookieJar, type Cookie } from '@reqit/core';

export class CookieService {
  private jars: Map<string, CookieJar> = new Map();

  private getStoragePath(collectionPath: string): string {
    return path.join(collectionPath, '.reqit', 'cookies.json');
  }

  /**
   * Retrieves or initializes the CookieJar for a collection.
   * Loads persisted cookies from .reqit/cookies.json if available.
   */
  public getJar(collectionPath?: string): CookieJar {
    if (!collectionPath) {
      if (!this.jars.has('__default__')) {
        this.jars.set('__default__', new CookieJar());
      }
      return this.jars.get('__default__')!;
    }

    const resolved = path.resolve(collectionPath);
    if (this.jars.has(resolved)) {
      return this.jars.get(resolved)!;
    }

    const jar = new CookieJar();
    const storageFile = this.getStoragePath(resolved);

    if (fs.existsSync(storageFile)) {
      try {
        const raw = fs.readFileSync(storageFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          jar.fromJSON(parsed);
        }
      } catch (err) {
        console.error(`Failed to load cookies from ${storageFile}:`, err);
      }
    }

    this.jars.set(resolved, jar);
    return jar;
  }

  /**
   * Persists the collection's cookie jar to .reqit/cookies.json.
   */
  public saveCookies(collectionPath?: string): void {
    if (!collectionPath) return;
    const resolved = path.resolve(collectionPath);
    const jar = this.jars.get(resolved);
    if (!jar) return;

    const storageDir = path.join(resolved, '.reqit');
    const storageFile = path.join(storageDir, 'cookies.json');

    try {
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      const data = JSON.stringify(jar.toJSON(), null, 2);
      fs.writeFileSync(storageFile, data, 'utf-8');
    } catch (err) {
      console.error(`Failed to save cookies to ${storageFile}:`, err);
    }
  }

  /**
   * Returns all cookies stored for a collection.
   */
  public getAll(collectionPath?: string): Cookie[] {
    const jar = this.getJar(collectionPath);
    return jar.getAllCookies();
  }

  /**
   * Adds or updates a cookie in the collection's jar and saves.
   */
  public addOrUpdate(collectionPath: string | undefined, cookie: Cookie): void {
    const jar = this.getJar(collectionPath);
    jar.addCookie(cookie);
    if (collectionPath) {
      this.saveCookies(collectionPath);
    }
  }

  /**
   * Removes a cookie by domain, path, and name.
   */
  public deleteCookie(
    collectionPath: string | undefined,
    domain: string,
    cookiePath: string,
    name: string,
  ): boolean {
    const jar = this.getJar(collectionPath);
    const deleted = jar.removeCookie(domain, cookiePath, name);
    if (collectionPath && deleted) {
      this.saveCookies(collectionPath);
    }
    return deleted;
  }

  /**
   * Clears all cookies for a collection.
   */
  public clear(collectionPath?: string): void {
    const jar = this.getJar(collectionPath);
    jar.clear();
    if (collectionPath) {
      this.saveCookies(collectionPath);
    }
  }
}

export const cookieService = new CookieService();
