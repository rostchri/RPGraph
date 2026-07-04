import {
  isLmStudioConnection,
  isOllamaConnection,
  isOpenRouterConnection,
} from '../llm/providerKind';
import type {
  ConnectionPreset,
  LmStudioModelInfo,
  OllamaModelInfo,
  OpenRouterModelInfo,
  ProviderConnectionCapabilities,
  ProviderConnectionHealth,
} from '../types';

export function lmStudioLlmModels(models: LmStudioModelInfo[]) {
  return models.filter((model) =>
    model.type === undefined || model.type === 'llm' || model.type === 'vlm',
  );
}

function selectedLmStudioModel(
  connection: ConnectionPreset,
  models: LmStudioModelInfo[],
) {
  const selectedModelId = connection.model.trim();
  if (!selectedModelId) {
    return undefined;
  }
  return models.find((model) => model.id === selectedModelId);
}

function selectedOpenRouterModel(
  connection: ConnectionPreset,
  models: OpenRouterModelInfo[],
) {
  const selectedModelId = connection.model.trim();
  if (!selectedModelId) {
    return undefined;
  }
  return models.find((model) => model.id === selectedModelId);
}

function selectedOllamaModel(
  connection: ConnectionPreset,
  models: OllamaModelInfo[],
) {
  const selectedModelId = connection.model.trim();
  if (!selectedModelId) {
    return undefined;
  }
  return models.find((model) => model.id === selectedModelId);
}

export function lmStudioCapabilitiesForConnection(
  connection: ConnectionPreset,
  models: LmStudioModelInfo[],
): ProviderConnectionCapabilities {
  const model = selectedLmStudioModel(connection, models);
  return {
    text: !!model || models.length > 0,
    vision: model?.vision === true,
    tools: model?.trainedForToolUse === true,
  };
}

export function openRouterCapabilitiesForConnection(
  connection: ConnectionPreset,
  models: OpenRouterModelInfo[],
): ProviderConnectionCapabilities {
  const model = selectedOpenRouterModel(connection, models);
  return {
    text: !!model || models.length > 0,
    vision: model?.vision === true,
  };
}

export function ollamaCapabilitiesForConnection(
  connection: ConnectionPreset,
  models: OllamaModelInfo[],
): ProviderConnectionCapabilities {
  const model = selectedOllamaModel(connection, models);
  return {
    text: !!model || models.length > 0,
    vision: model?.vision === true,
    tools: model?.trainedForToolUse === true,
  };
}

export function connectionWithLmStudioCapabilities(
  connection: ConnectionPreset,
  models: LmStudioModelInfo[],
): ConnectionPreset {
  if (!isLmStudioConnection(connection)) {
    return connection;
  }
  const capabilities = lmStudioCapabilitiesForConnection(connection, models);
  return {
    ...connection,
    vision: capabilities.vision === true,
  };
}

export function connectionWithOpenRouterCapabilities(
  connection: ConnectionPreset,
  models: OpenRouterModelInfo[],
): ConnectionPreset {
  if (!isOpenRouterConnection(connection)) {
    return connection;
  }
  const capabilities = openRouterCapabilitiesForConnection(connection, models);
  return {
    ...connection,
    vision: capabilities.vision === true,
  };
}

export function connectionWithOllamaCapabilities(
  connection: ConnectionPreset,
  models: OllamaModelInfo[],
): ConnectionPreset {
  if (!isOllamaConnection(connection)) {
    return connection;
  }
  const capabilities = ollamaCapabilitiesForConnection(connection, models);
  return {
    ...connection,
    vision: capabilities.vision === true,
  };
}

export function providerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function providerCheckConnectionStatus(
  connection: ConnectionPreset,
  health: ProviderConnectionHealth,
) {
  const name = connection.label || connection.baseUrl;
  if (health.status === 'online') {
    return `${name}: ${health.detail ?? 'Connected.'}`;
  }
  if (health.status === 'checking') {
    return `${name}: Checking ...`;
  }
  if (health.status === 'warning') {
    return `${name}: ${health.detail ?? 'Setup incomplete.'}`;
  }
  if (health.status === 'offline') {
    return `${name}: ${health.detail ?? 'Offline.'}`;
  }
  return `${name}: Not checked yet.`;
}

export function providerModelCountDetail(count: number) {
  return count === 1 ? 'Connected. 1 model found.' : `Connected. ${count} models found.`;
}

export function providerCheckedAt() {
  return Date.now();
}

export function createProviderConnectionId() {
  return `connection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
