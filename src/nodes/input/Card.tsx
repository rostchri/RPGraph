import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { StatLine } from '../../components/StatLine';
import { useBackdropDismiss } from '../../components/useBackdropDismiss';
import {
  autoTurnInstructionDefinitions,
  autoTurnInstructionSettings,
} from '../../chat/instructions';
import type { WorkflowNode } from '../../types';
import { useNodeActions } from '../NodeActionsContext';
import { useNodeView } from '../NodeViewContext';
import { ConnectionSelect } from '../shared/ConnectionSelect';
import { LlmCallMetrics, runStateClassName, useNodeLayoutSync } from '../shared/CardView';
import { PortLabel } from '../shared/PortValue';
import {
  promptPresetDisplayText,
  promptPresetSource,
  promptSettingForSource,
  type PromptPresetSource,
} from '../shared/promptPresets';

function AutoTurnPromptTextarea({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + lineHeight}px`;
  }, [value, disabled]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      disabled={disabled}
      spellCheck={false}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

export function InputNodeCard({ id, data }: NodeProps<WorkflowNode>) {
  const nodeBodyRef = useNodeLayoutSync(id);
  const { textPreview, updateData, showOutputFormatHelp } = useNodeActions();
  const view = useNodeView();
  const { estimatedTokenBytesPerToken } = view;
  const [showAutoTurnInstructions, setShowAutoTurnInstructions] = useState(false);
  const autoTurnBackdropDismiss = useBackdropDismiss<HTMLDivElement>(() => setShowAutoTurnInstructions(false));
  const [workflowPromptTexts, setWorkflowPromptTexts] = useState<Record<string, string>>({});
  const autoTurnInstructions = autoTurnInstructionSettings(data.autoTurnInstructions);
  const updateAutoTurnInstruction = (
    key: keyof typeof autoTurnInstructions,
    patch: Partial<(typeof autoTurnInstructions)[typeof key]>,
  ) => {
    updateData(id, {
      autoTurnInstructions: {
        ...autoTurnInstructions,
        [key]: {
          ...autoTurnInstructions[key],
          ...patch,
        },
      },
    });
  };
  const saveLocalAutoTurnPrompt = (presetKey: string, value: string) => {
    view.setPromptTextCustomPresets((current) => ({
      ...current,
      [presetKey]: value,
    }));
  };
  return (
    <div className={`workflow-node translator-node input-node${runStateClassName(data)}`} ref={nodeBodyRef}>
      <div className="node-title-row">
        <span className="node-dot" />
        <strong>{data.label}</strong>
      </div>
      <LlmCallMetrics data={data} />
      <span className="node-description">{data.description}</span>
      <ConnectionSelect id={id} label="INPUT TRANSLATOR LLM" connectionId={data.connectionId} />
      <span className="node-field-label metric-label">TOKEN STATS</span>
      <div className="node-metrics">
        <StatLine text={data.preview} bytesPerEstimatedToken={estimatedTokenBytesPerToken} />
      </div>
      <div className="input-node-action-row">
        <button className="inspect-button nodrag" type="button" onClick={() => textPreview(id)}>
          Text Preview
        </button>
        <button className="inspect-button nodrag" type="button" onClick={() => setShowAutoTurnInstructions(true)}>
          AutoTurn Prompt
        </button>
      </div>
      <div className="workflow-ports">
        <div className="workflow-port workflow-port-output">
          <PortLabel data={data} direction="output" label="Text" valueType="text" />
          <Handle type="source" position={Position.Right} />
        </div>
        <div className="workflow-port workflow-port-output">
          <PortLabel data={data} direction="output" handle="image" label="Image" valueType="image" />
          <Handle id="image" type="source" position={Position.Right} />
        </div>
        <div className="workflow-port workflow-port-output">
          <PortLabel data={data} direction="output" handle="message-format" label="Message Format" valueType="number" />
          <button
            className="node-info-button input-port-help-button nodrag"
            type="button"
            aria-label="Message Format help"
            onClick={() => showOutputFormatHelp('user-input')}
          >
            ?
          </button>
          <Handle id="message-format" type="source" position={Position.Right} />
        </div>
        <div className="workflow-port workflow-port-output">
          <PortLabel data={data} direction="output" handle="turn-mode" label="Turn Mode" valueType="number" />
          <button
            className="node-info-button input-port-help-button nodrag"
            type="button"
            aria-label="Turn Mode help"
            onClick={() => showOutputFormatHelp('user-input')}
          >
            ?
          </button>
          <Handle id="turn-mode" type="source" position={Position.Right} />
        </div>
        <div className="workflow-port workflow-port-output">
          <PortLabel data={data} direction="output" handle="direct-actions" label="Direct Actions" valueType="mixed" />
          <button
            className="node-info-button input-port-help-button nodrag"
            type="button"
            aria-label="Direct Actions help"
            onClick={() => showOutputFormatHelp('user-input')}
          >
            ?
          </button>
          <Handle id="direct-actions" type="source" position={Position.Right} />
        </div>
      </div>
      {showAutoTurnInstructions && typeof document !== 'undefined' && createPortal(
        <div className="dialog-backdrop" {...autoTurnBackdropDismiss}>
          <section
            className="autoturn-instructions-dialog nodrag"
            role="dialog"
            aria-modal="true"
            aria-label="AutoTurn Prompt"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-title-row">
              <div>
                <span className="eyebrow">USER INPUT</span>
                <h2>AutoTurn Prompt</h2>
              </div>
              <button type="button" onClick={() => setShowAutoTurnInstructions(false)}>
                Close
              </button>
            </div>
            <div className="autoturn-instruction-list">
              {autoTurnInstructionDefinitions.map((definition) => {
                const entry = autoTurnInstructions[definition.key] ?? {
                  mode: 'default',
                  customText: '',
                };
                const presetKey = `input.autoturn.${definition.key}`;
                const localPromptText = view.promptTextCustomPresets[presetKey];
                const promptSource = promptPresetSource(entry, definition.defaultText, localPromptText);
                const textValue = promptPresetDisplayText(
                  promptSource,
                  entry,
                  definition.defaultText,
                  localPromptText,
                );
                const effectiveWorkflowPromptText = workflowPromptTexts[presetKey] ??
                  (promptSource === 'workflow' ? entry.customText : undefined);
                const switchPromptSource = (source: PromptPresetSource) => {
                  if (promptSource === 'workflow' && entry.customText) {
                    setWorkflowPromptTexts((current) => ({
                      ...current,
                      [presetKey]: entry.customText ?? '',
                    }));
                  }
                  const next = promptSettingForSource(
                    source,
                    textValue,
                    definition.defaultText,
                    localPromptText,
                    effectiveWorkflowPromptText,
                  );
                  if (source === 'custom') {
                    saveLocalAutoTurnPrompt(presetKey, next.customText ?? definition.defaultText);
                  }
                  updateAutoTurnInstruction(definition.key, next);
                };
                return (
                  <section className="autoturn-instruction-editor" key={definition.key}>
                    <div className="autoturn-instruction-top">
                      <div className="autoturn-instruction-mode" role="group" aria-label={`${definition.title} mode`}>
                        <button
                          type="button"
                          className={promptSource === 'default' ? 'active' : ''}
                          onClick={() => switchPromptSource('default')}
                        >
                          Default
                        </button>
                        <button
                          type="button"
                          className={promptSource === 'custom' ? 'active' : ''}
                          onClick={() => switchPromptSource('custom')}
                        >
                          Custom
                        </button>
                        <button
                          type="button"
                          className={promptSource === 'workflow' ? 'active' : ''}
                          disabled={!effectiveWorkflowPromptText}
                          onClick={() => switchPromptSource('workflow')}
                        >
                          In Workflow
                        </button>
                      </div>
                      <div className="autoturn-instruction-heading">
                        <h3>{definition.title}</h3>
                        {!!definition.variables.length && (
                          <span>{definition.variables.join(' ')}</span>
                        )}
                      </div>
                    </div>
                    <AutoTurnPromptTextarea
                      value={textValue}
                      disabled={promptSource === 'default'}
                      onChange={(value) => {
                        if (promptSource === 'custom') {
                          saveLocalAutoTurnPrompt(presetKey, value);
                        }
                        updateAutoTurnInstruction(definition.key, {
                          mode: 'custom',
                          customText: value,
                        });
                      }}
                    />
                  </section>
                );
              })}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
