import { getCommunityPackageCount } from '@/api/settings';
import { ICommunityNodesState, IRootState } from '@/Interface';
import Vue from 'vue';
import { ActionContext, Module } from 'vuex';

const module: Module<ICommunityNodesState, IRootState> = {
	namespaced: true,
	state: {
		availablePackageCount: 0,
	},
	mutations: {
		setPackageCount: (state: ICommunityNodesState, count: number) => {
			state.availablePackageCount = count;
		},
	},
	getters: {
		packageCount(state: ICommunityNodesState): number {
			return state.availablePackageCount;
		},
	},
	actions: {
		async fetchAvailableCommunityPackageCount(context: ActionContext<ICommunityNodesState, IRootState>) {
			const packageCount = await getCommunityPackageCount();
			context.commit('setPackageCount', packageCount);
		},
	},
};

export default module;
