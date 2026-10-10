import packageInfo from '../package.json' with { type: 'json' };

export const SIMULATION_VERSION = packageInfo.version;
