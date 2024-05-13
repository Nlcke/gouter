import { expect, describe, it } from '@jest/globals';
import { GouterNavigation } from '..';
import { GouterState } from '../state';

describe('GouterNavigation', () => {
  it('initializes with correct rootState', () => {
    /** @type {import('..').Routes<any>} */
    const routes = { A: {} };
    const navigation = new GouterNavigation(routes, 'A', {});
    expect(navigation.rootState).toStrictEqual(new GouterState('A', {}));
  });
});
