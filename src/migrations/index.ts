import * as migration_20260112_215221_initial from './20260112_215221_initial';

export const migrations = [
  {
    up: migration_20260112_215221_initial.up,
    down: migration_20260112_215221_initial.down,
    name: '20260112_215221_initial'
  },
];
