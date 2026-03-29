// DeliveryIntegrityEnums loader
// This module loads canonical enums from the YAML source of truth.
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

const ENUMS_PATH = path.resolve(__dirname, '../../../knowledge/core/07_DeliveryIntegrityEnums.yaml');

export interface DeliveryIntegrityEnums {
  loop_type: Record<string, string>;
}

let enumsCache: DeliveryIntegrityEnums | null = null;

export function getDeliveryIntegrityEnums(): DeliveryIntegrityEnums {
  if (enumsCache) return enumsCache;
  const file = fs.readFileSync(ENUMS_PATH, 'utf8');
  const doc = yaml.load(file) as any;
  enumsCache = {
    loop_type: doc.loop_type || {},
  };
  return enumsCache;
}

export function getLoopTypeKey(key: string): string {
  const enums = getDeliveryIntegrityEnums();
  return Object.keys(enums.loop_type).includes(key) ? key : '';
}

export function getLoopTypeValue(key: string): string {
  const enums = getDeliveryIntegrityEnums();
  return enums.loop_type[key] || '';
}
