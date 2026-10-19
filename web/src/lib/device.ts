/**
 * Device identification for CMF Watch models.
 * Supports CMF Watch 3 Pro and CMF Watch Pro 2.
 */

export type WatchModel = 'watch3pro' | 'watchpro2' | 'unknown'

export interface DeviceInfo {
  model: WatchModel
  modelName: string
  firmwareVersion: string
  serialNumber?: string
  supported: boolean
  features: {
    photoDials: boolean
    structuredDials: boolean
    apps: boolean
    aodScreen: boolean
  }
}

const MODEL_PATTERNS: Array<{ pattern: RegExp; model: WatchModel; name: string }> = [
  { pattern: /CMF Watch 3 Pro/i, model: 'watch3pro', name: 'CMF Watch 3 Pro' },
  { pattern: /CMF Watch Pro 2/i, model: 'watchpro2', name: 'CMF Watch Pro 2' },
  { pattern: /CMF Watch/i, model: 'unknown', name: 'CMF Watch' },
]

export function identifyModel(deviceName: string): { model: WatchModel; modelName: string } {
  for (const { pattern, model, name } of MODEL_PATTERNS) {
    if (pattern.test(deviceName)) {
      return { model, modelName: name }
    }
  }
  return { model: 'unknown', modelName: 'Unknown CMF Watch' }
}

export function getDeviceFeatures(model: WatchModel): DeviceInfo['features'] {
  switch (model) {
    case 'watch3pro':
      return {
        photoDials: true,
        structuredDials: true,
        apps: true,
        aodScreen: true,
      }
    case 'watchpro2':
      return {
        photoDials: true,
        structuredDials: true,
        apps: true,
        aodScreen: true,
      }
    default:
      return {
        photoDials: true,
        structuredDials: false,
        apps: false,
        aodScreen: false,
      }
  }
}

export function createDeviceInfo(
  deviceName: string,
  firmwareVersion: string,
  serialNumber?: string,
): DeviceInfo {
  const { model, modelName } = identifyModel(deviceName)
  const features = getDeviceFeatures(model)
  
  return {
    model,
    modelName,
    firmwareVersion,
    serialNumber,
    supported: model !== 'unknown',
    features,
  }
}

export function isFeatureSupported(info: DeviceInfo, feature: keyof DeviceInfo['features']): boolean {
  return info.features[feature]
}
