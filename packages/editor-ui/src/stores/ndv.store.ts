import { useStorage } from '@vueuse/core';
import { LOCAL_STORAGE_MAPPING_IS_ONBOARDED, STORES } from '@/constants';
import type {
	INodeUi,
	IRunDataDisplayMode,
	NDVState,
	NodePanelType,
	TargetItem,
	XYPosition,
} from '@/Interface';
import type { INodeIssues, IRunData } from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import { defineStore } from 'pinia';
import { v4 as uuid } from 'uuid';
import { useWorkflowsStore } from './workflows.store';

export const useNDVStore = defineStore(STORES.NDV, {
	state: (): NDVState => ({
		activeNodeName: null,
		mainPanelDimensions: {},
		sessionId: '',
		input: {
			displayMode: 'schema',
			nodeName: undefined,
			run: undefined,
			branch: undefined,
			data: {
				isEmpty: true,
			},
		},
		output: {
			displayMode: 'table',
			branch: undefined,
			data: {
				isEmpty: true,
			},
			editMode: {
				enabled: false,
				value: '',
			},
		},
		focusedMappableInput: '',
		mappingTelemetry: {},
		hoveringItem: null,
		draggable: {
			isDragging: false,
			type: '',
			data: '',
			canDrop: false,
			stickyPosition: null,
		},
		isMappingOnboarded: useStorage(LOCAL_STORAGE_MAPPING_IS_ONBOARDED, undefined).value === 'true',
	}),
	getters: {
		activeNode(): INodeUi | null {
			const workflowsStore = useWorkflowsStore();
			return workflowsStore.getNodeByName(this.activeNodeName || '');
		},
		ndvInputData(): IRunData[] {
			const workflowsStore = useWorkflowsStore();
			const executionData = workflowsStore.getWorkflowExecution;
			const inputNodeName: string | undefined = this.input.nodeName;
			const inputRunIndex: number = this.input.run ?? 0;
			const inputBranchIndex: number = this.input.branch ?? 0;

			if (
				!executionData ||
				!inputNodeName ||
				inputRunIndex === undefined ||
				inputBranchIndex === undefined
			) {
				return [];
			}

			return executionData.data?.resultData?.runData?.[inputNodeName]?.[inputRunIndex]?.data
				?.main?.[inputBranchIndex];
		},
		getPanelDisplayMode() {
			return (panel: NodePanelType) => this[panel].displayMode;
		},
		inputPanelDisplayMode(): IRunDataDisplayMode {
			return this.input.displayMode;
		},
		outputPanelDisplayMode(): IRunDataDisplayMode {
			return this.output.displayMode;
		},
		isDraggableDragging(): boolean {
			return this.draggable.isDragging;
		},
		draggableType(): string {
			return this.draggable.type;
		},
		draggableData(): string {
			return this.draggable.data;
		},
		canDraggableDrop(): boolean {
			return this.draggable.canDrop;
		},
		outputPanelEditMode(): NDVState['output']['editMode'] {
			return this.output.editMode;
		},
		getMainPanelDimensions() {
			return (panelType: string) => {
				const defaults = { relativeRight: 1, relativeLeft: 1, relativeWidth: 1 };
				return { ...defaults, ...this.mainPanelDimensions[panelType] };
			};
		},
		draggableStickyPos(): XYPosition | null {
			return this.draggable.stickyPosition;
		},
		ndvInputNodeName(): string | undefined {
			return this.input.nodeName;
		},
		ndvInputRunIndex(): number | undefined {
			return this.input.run;
		},
		ndvInputBranchIndex(): number | undefined {
			return this.input.branch;
		},
		isDNVDataEmpty() {
			return (panel: 'input' | 'output'): boolean => this[panel].data.isEmpty;
		},
		isInputParentOfActiveNode(): boolean {
			const inputNodeName = this.ndvInputNodeName;
			if (!this.activeNode || !inputNodeName) {
				return false;
			}
			const workflow = useWorkflowsStore().getCurrentWorkflow();
			const parentNodes = workflow.getParentNodes(this.activeNode.name, NodeConnectionType.Main, 1);
			return parentNodes.includes(inputNodeName);
		},
		hoveringItemNumber(): number {
			return (this.hoveringItem?.itemIndex ?? 0) + 1;
		},
		getHoveringItem(): TargetItem | null {
			if (this.isInputParentOfActiveNode) {
				return this.hoveringItem;
			}

			return null;
		},
	},
	actions: {
		setActiveNodeName(nodeName: string | null): void {
			this.activeNodeName = nodeName;
		},
		setInputNodeName(nodeName: string | undefined): void {
			this.input = {
				...this.input,
				nodeName,
			};
		},
		setInputRunIndex(run?: number): void {
			this.input = {
				...this.input,
				run,
			};
		},
		setMainPanelDimensions(params: {
			panelType: string;
			dimensions: { relativeLeft?: number; relativeRight?: number; relativeWidth?: number };
		}): void {
			this.mainPanelDimensions = {
				...this.mainPanelDimensions,
				[params.panelType]: {
					...this.mainPanelDimensions[params.panelType],
					...params.dimensions,
				},
			};
		},
		setNDVSessionId(): void {
			this.sessionId = `ndv-${uuid()}`;
		},
		resetNDVSessionId(): void {
			this.sessionId = '';
		},
		setPanelDisplayMode(params: { pane: NodePanelType; mode: IRunDataDisplayMode }): void {
			this[params.pane].displayMode = params.mode;
		},
		setOutputPanelEditModeEnabled(isEnabled: boolean): void {
			this.output.editMode.enabled = isEnabled;
		},
		setOutputPanelEditModeValue(payload: string): void {
			this.output.editMode.value = payload;
		},
		setMappableNDVInputFocus(paramName: string): void {
			this.focusedMappableInput = paramName;
		},
		draggableStartDragging({ type, data }: { type: string; data: string }): void {
			this.draggable = {
				isDragging: true,
				type,
				data,
				canDrop: false,
				stickyPosition: null,
			};
		},
		draggableStopDragging(): void {
			this.draggable = {
				isDragging: false,
				type: '',
				data: '',
				canDrop: false,
				stickyPosition: null,
			};
		},
		setDraggableStickyPos(position: XYPosition | null): void {
			this.draggable.stickyPosition = position;
		},
		setDraggableCanDrop(canDrop: boolean): void {
			this.draggable.canDrop = canDrop;
		},
		setMappingTelemetry(telemetry: { [key: string]: string | number | boolean }): void {
			this.mappingTelemetry = { ...this.mappingTelemetry, ...telemetry };
		},
		resetMappingTelemetry(): void {
			this.mappingTelemetry = {};
		},
		setHoveringItem(item: null | NDVState['hoveringItem']): void {
			this.hoveringItem = item;
		},
		setNDVBranchIndex(e: { pane: 'input' | 'output'; branchIndex: number }): void {
			this[e.pane].branch = e.branchIndex;
		},
		setNDVPanelDataIsEmpty(payload: { panel: 'input' | 'output'; isEmpty: boolean }): void {
			this[payload.panel].data.isEmpty = payload.isEmpty;
		},
		disableMappingHint(store = true) {
			this.isMappingOnboarded = true;
			if (store) {
				window.localStorage.setItem(LOCAL_STORAGE_MAPPING_IS_ONBOARDED, 'true');
			}
		},
		updateNodeParameterIssues(issues: INodeIssues): void {
			const workflowsStore = useWorkflowsStore();
			const activeNode = workflowsStore.getNodeByName(this.activeNodeName || '');

			if (activeNode) {
				const nodeIndex = workflowsStore.workflow.nodes.findIndex((node) => {
					return node.name === activeNode.name;
				});

				workflowsStore.updateNodeAtIndex(nodeIndex, {
					issues: {
						...activeNode.issues,
						...issues,
					},
				});
			}
		},
	},
});
