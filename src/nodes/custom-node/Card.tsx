import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useId, type ReactNode } from 'react';
import type { WorkflowNode } from '../../types';
import { useNodeActions } from '../NodeActionsContext';
import { LlmCallMetrics, runStateClassName, useNodeLayoutSync } from '../shared/CardView';
import { ConnectionSelect } from '../shared/ConnectionSelect';
import { NodeCustomSelect } from '../shared/NodeCustomSelect';
import { PortLabel } from '../shared/PortValue';
import { PostOutputToggle } from '../shared/PostOutputToggle';
import { runtimePortValueKey } from '../shared/portRuntime';
import { JsonSyntaxTextarea } from '../shared/JsonSyntaxTextarea';
import { customNodeDefinition, type CustomNodeDefinition, type CustomNodeElement } from './model';

function updateControlValue(
  definition: CustomNodeDefinition,
  controlId: string,
  value: unknown,
): CustomNodeDefinition {
  return {
    ...definition,
    controls: definition.controls.map((control) =>
      control.id === controlId ? { ...control, value } : control,
    ),
  };
}

function controlValue(control: CustomNodeElement) {
  if (typeof control.value === 'string' || typeof control.value === 'number' || typeof control.value === 'boolean') {
    return control.value;
  }
  return '';
}

function textareaRows(control: CustomNodeElement) {
  if (control.layout?.h && Number.isFinite(control.layout.h)) {
    return Math.max(1, Math.min(10, Math.round(control.layout.h / 28)));
  }
  const value = typeof control.value === 'string' ? control.value : '';
  return Math.max(1, Math.min(6, value.split(/\r?\n/).length));
}

function numberFromUnknown(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function CustomNodeMeterDisplay({
  display,
  runtimeValue,
}: {
  display: CustomNodeElement;
  runtimeValue: string | undefined;
}) {
  const min = numberFromUnknown(display.min, 0);
  const max = Math.max(min + 1, numberFromUnknown(display.max, 100));
  const current = Math.min(max, Math.max(min, numberFromUnknown(runtimeValue ?? display.value, min)));
  const percent = ((current - min) / (max - min)) * 100;
  return (
    <div className="custom-node-meter" title={`${display.label}: ${current} / ${max}`}>
      <div className="custom-node-meter-row">
        <span>{min}</span>
        <strong>{current}</strong>
        <span>{max}</span>
      </div>
      <div className="custom-node-meter-track">
        <span style={{ width: `${percent}%` }} />
      </div>
      {display.text && <small>{display.text}</small>}
    </div>
  );
}

function CustomNodePortLabel({
  data,
  direction,
  handle,
  label,
  valueType,
  useRuntimeValue,
}: {
  data: WorkflowNode['data'];
  direction: 'input' | 'output';
  handle: string;
  label: string;
  valueType: string;
  useRuntimeValue: boolean;
}) {
  const hasRuntimeValue = data.runtimePortValues?.[runtimePortValueKey(direction, handle)] !== undefined;
  if (useRuntimeValue || hasRuntimeValue) {
    return <PortLabel data={data} direction={direction} handle={handle} label={label} valueType={valueType} />;
  }
  return (
    <span className="port-label">
      <span className="port-label-name">{label}</span>
      <small className="port-runtime-value">{valueType}</small>
    </span>
  );
}

export function CustomNodeBody({
  data,
  definition,
  connectionElement,
  postConnectionElement,
  renderHandles,
  onOpenAssistant,
  onControlChange,
  onGeneratedButtonClick,
  onStateButtonClick,
}: {
  data: WorkflowNode['data'];
  definition: CustomNodeDefinition;
  connectionElement: ReactNode;
  postConnectionElement?: ReactNode;
  renderHandles: boolean;
  onOpenAssistant?: () => void;
  onControlChange?: (controlId: string, value: unknown) => void;
  onGeneratedButtonClick?: (label: string) => void;
  onStateButtonClick?: (control: CustomNodeElement) => void;
}) {
  // Radio groups are scoped per rendered node; a shared control id in two
  // Custom Nodes must not merge their radios into one document-wide group.
  const radioGroupPrefix = useId();
  return (
    <>
      <div className="node-title-row custom-node-title-row">
        <span className="node-dot" />
        <strong>{data.label}</strong>
        {onOpenAssistant && (
          <button
            className="load-text-button nodrag custom-node-assistant-button"
            type="button"
            onClick={onOpenAssistant}
          >
            Customize Node
          </button>
        )}
      </div>
      <div className="custom-node-function-title">
        {definition.title?.trim() || 'Custom Node'}
      </div>
      <LlmCallMetrics data={data} />

      {connectionElement}
      {postConnectionElement}

      <div className="custom-node-display">
        {definition.displays.length > 0 ? definition.displays.map((display) => (
          <div className="custom-node-display-item" key={display.id}>
            <span className="node-field-label">{display.label}</span>
            {display.type === 'meter' ? (
              <CustomNodeMeterDisplay
                display={display}
                runtimeValue={data.customNodeRuntimeDisplays?.[display.id]}
              />
            ) : (
              <div className="node-preview custom-node-info">
                {data.customNodeRuntimeDisplays?.[display.id] ?? display.text ?? data.preview}
              </div>
            )}
          </div>
        )) : (
          <>
            <span className="node-field-label">ABOUT</span>
            <div className="node-preview custom-node-info">{data.preview}</div>
          </>
        )}
      </div>

      {definition.controls.length > 0 && (
        <div className="custom-node-controls">
          {definition.controls.map((control) => {
            const value = controlValue(control);
            if (control.type === 'checkbox') {
              return (
                <label className="node-toggle custom-node-control" key={control.id}>
                  <input
                    className="nodrag"
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => onControlChange?.(control.id, event.currentTarget.checked)}
                    disabled={!onControlChange}
                  />
                  <span>{control.label}</span>
                </label>
              );
            }
            if (control.type === 'slider') {
              const numberValue = typeof value === 'number' ? value : Number(control.min ?? 0);
              return (
                <label className="custom-node-control" key={control.id}>
                  <span className="node-field-label">{control.label}</span>
                  <div className="option-range-row">
                    <input
                      className="nodrag"
                      type="range"
                      min={control.min ?? 0}
                      max={control.max ?? 100}
                      step={control.step ?? 1}
                      value={numberValue}
                      onChange={(event) => onControlChange?.(control.id, Number(event.currentTarget.value))}
                      disabled={!onControlChange}
                    />
                    <span>{numberValue}</span>
                  </div>
                </label>
              );
            }
            if (control.type === 'textarea') {
              return (
                <label className="custom-node-control" key={control.id}>
                  <span className="node-field-label">{control.label}</span>
                  <JsonSyntaxTextarea
                    className="node-textarea nodrag nowheel"
                    rows={textareaRows(control)}
                    value={String(value)}
                    onChange={(val) => onControlChange?.(control.id, val)}
                    readOnly={!onControlChange}
                  />
                </label>
              );
            }
            if (control.type === 'select') {
              const options = control.options ?? [];
              return (
                <label className="custom-node-control" key={control.id}>
                  <span className="node-field-label">{control.label}</span>
                  <NodeCustomSelect
                    value={String(value || options[0] || '')}
                    disabled={!onControlChange}
                    onChange={(nextValue) => onControlChange?.(control.id, nextValue)}
                    options={options.map((option) => ({ value: option, label: option }))}
                  />
                </label>
              );
            }
            if (control.type === 'radio') {
              const options = control.options ?? [];
              const selected = String(value || options[0] || '');
              return (
                <fieldset className="custom-node-control custom-node-radio-group" key={control.id}>
                  <legend className="node-field-label">{control.label}</legend>
                  {options.map((option) => (
                    <label className="node-toggle" key={option}>
                      <input
                        className="nodrag"
                        type="radio"
                        name={`${radioGroupPrefix}-${control.id}-radio`}
                        value={option}
                        checked={selected === option}
                        onChange={(event) => onControlChange?.(control.id, event.currentTarget.value)}
                        disabled={!onControlChange}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </fieldset>
              );
            }
            if (control.type === 'button') {
              const runsCode = control.action === 'run-code';
              return (
                <div className="custom-node-button-slot" key={control.id}>
                  <button
                    className="inspect-button nodrag custom-node-generated-button"
                    type="button"
                    onClick={() => runsCode ? onGeneratedButtonClick?.(control.label) : onStateButtonClick?.(control)}
                    disabled={runsCode ? !onGeneratedButtonClick : !onStateButtonClick}
                  >
                    {control.label}
                  </button>
                </div>
              );
            }
            return (
              <label className="custom-node-control" key={control.id}>
                <span className="node-field-label">{control.label}</span>
                <input
                  className="node-text-input nodrag"
                  type={control.type === 'number-input' ? 'number' : 'text'}
                  value={String(value)}
                  onChange={(event) => onControlChange?.(
                    control.id,
                    control.type === 'number-input' ? Number(event.currentTarget.value) : event.currentTarget.value,
                  )}
                  readOnly={!onControlChange}
                />
              </label>
            );
          })}
        </div>
      )}

      {definition.inputs.length > 0 && (
        <div className="workflow-ports custom-node-ports">
          {definition.inputs.map((port) => (
            <div className="workflow-port workflow-port-input" key={port.id}>
              {renderHandles
                ? <Handle id={port.id} type="target" position={Position.Left} />
                : <span className="custom-node-preview-handle input" aria-hidden="true" />}
              <CustomNodePortLabel
                data={data}
                direction="input"
                handle={port.id}
                label={port.label}
                valueType={port.valueType}
                useRuntimeValue={renderHandles}
              />
            </div>
          ))}
        </div>
      )}

      {definition.outputs.length > 0 && (
        <div className="workflow-ports custom-node-ports">
          {definition.outputs.map((port) => (
            <div className="workflow-port workflow-port-output" key={port.id}>
              <CustomNodePortLabel
                data={data}
                direction="output"
                handle={port.id}
                label={port.label}
                valueType={port.valueType}
                useRuntimeValue={renderHandles}
              />
              {renderHandles
                ? <Handle id={port.id} type="source" position={Position.Right} />
                : <span className="custom-node-preview-handle output" aria-hidden="true" />}
            </div>
          ))}
        </div>
      )}

      <div className="node-actions custom-node-actions">
        <span className="run-note">{data.preview}</span>
      </div>
    </>
  );
}

export function CustomNodeCard({ id, data }: NodeProps<WorkflowNode>) {
  const actions = useNodeActions();
  const nodeBodyRef = useNodeLayoutSync(id);
  const definition = customNodeDefinition(data.customNodeDefinition);

  function changeControl(controlId: string, value: unknown) {
    actions.updateData(id, {
      customNodeDefinition: updateControlValue(definition, controlId, value),
    });
  }

  function clickStateButton(control: CustomNodeElement) {
    if (!control.action || control.action === 'run-code' || !control.stateKey) {
      actions.updateData(id, { preview: `${control.label} clicked` });
      return;
    }
    const nextState = { ...definition.state };
    if (control.action === 'toggle-state') {
      nextState[control.stateKey] = !nextState[control.stateKey];
    } else {
      nextState[control.stateKey] = control.stateValue ?? true;
    }
    actions.updateData(id, {
      preview: `${control.label} updated state`,
      customNodeDefinition: {
        ...definition,
        state: nextState,
      },
    });
  }

  return (
    <div className={`workflow-node custom-node${runStateClassName(data)}`} ref={nodeBodyRef}>
      <CustomNodeBody
        data={data}
        definition={definition}
        connectionElement={(
          <ConnectionSelect
            id={id}
            label="LLM PROVIDER"
            connectionId={data.connectionId}
          />
        )}
        postConnectionElement={<PostOutputToggle id={id} enabled={data.runAfterRpOutput} />}
        renderHandles
        onOpenAssistant={() => actions.openCustomNodeAssistant(id)}
        onControlChange={changeControl}
        onGeneratedButtonClick={(label) => void actions.runCustomNodeButton(id, label)}
        onStateButtonClick={clickStateButton}
      />
    </div>
  );
}
