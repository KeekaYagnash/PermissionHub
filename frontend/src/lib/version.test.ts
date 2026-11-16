import {it,expect} from 'vitest';
import metadata from '../../package.json';
import {applicationVersion} from './version';
it('uses the existing frontend package version rather than a hardcoded UI release',()=>expect(applicationVersion).toBe(metadata.version));
