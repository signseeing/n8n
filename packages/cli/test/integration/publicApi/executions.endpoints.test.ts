import express = require('express');
import { v4 as uuid } from 'uuid';

import { ActiveWorkflowRunner, Db } from '../../../src';
import config = require('../../../config');
import { Role } from '../../../src/databases/entities/Role';
import { randomApiKey, randomEmail, randomName, randomValidPassword } from '../shared/random';

import * as utils from '../shared/utils';
import * as testDb from '../shared/testDb';

let app: express.Application;
let testDbName = '';
let globalOwnerRole: Role;
let globalMemberRole: Role;
let workflowOwnerRole: Role;
let credentialOwnerRole: Role;
let workflowRunner: ActiveWorkflowRunner.ActiveWorkflowRunner;

jest.mock('../../../src/telemetry');

beforeAll(async () => {
	app = await utils.initTestServer({ endpointGroups: ['publicApi'], applyAuth: false });
	const initResult = await testDb.init();
	testDbName = initResult.testDbName;

	const [
		fetchedGlobalOwnerRole,
		fetchedGlobalMemberRole,
		fetchedWorkflowOwnerRole,
		fetchedCredentialOwnerRole,
	] = await testDb.getAllRoles();

	globalOwnerRole = fetchedGlobalOwnerRole;
	globalMemberRole = fetchedGlobalMemberRole;
	workflowOwnerRole = fetchedWorkflowOwnerRole;
	credentialOwnerRole = fetchedCredentialOwnerRole;

	utils.initTestTelemetry();
	utils.initTestLogger();
	// initializing binary manager leave some async operations open
	// TODO mockup binary data mannager to avoid error
	await utils.initBinaryManager();
	await utils.initNodeTypes();
	workflowRunner = await utils.initActiveWorkflowRunner();
});

beforeEach(async () => {
	// do not combine calls - shared tables must be cleared first and separately
	await testDb.truncate(['SharedCredentials', 'SharedWorkflow'], testDbName);
	await testDb.truncate(['User', 'Workflow', 'Credentials', 'Execution'], testDbName);

	await testDb.createUser({
		id: INITIAL_TEST_USER.id,
		email: INITIAL_TEST_USER.email,
		password: INITIAL_TEST_USER.password,
		firstName: INITIAL_TEST_USER.firstName,
		lastName: INITIAL_TEST_USER.lastName,
		globalRole: globalOwnerRole,
		apiKey: INITIAL_TEST_USER.apiKey,
	});

	config.set('userManagement.disabled', false);
	config.set('userManagement.isInstanceOwnerSetUp', true);
	config.set('userManagement.emails.mode', 'smtp');
});

afterEach(async () => {
	await workflowRunner.removeAll();
});

afterAll(async () => {
	await testDb.terminate(testDbName);
});

test('GET /executions/:executionId should fail due to missing API Key', async () => {
	const owner = await Db.collections.User!.findOneOrFail();

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: false, user: owner });

	const response = await authOwnerAgent.get('/v1/executions/1');

	expect(response.statusCode).toBe(401);
});

test('GET /executions/:executionId should fail due to invalid API Key', async () => {
	const owner = await Db.collections.User!.findOneOrFail();

	owner.apiKey = null;

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: false, user: owner });

	const response = await authOwnerAgent.get('/v1/executions/2');

	expect(response.statusCode).toBe(401);
});

test('GET /executions/:executionId should fail due no instance owner not setup', async () => {
	config.set('userManagement.isInstanceOwnerSetUp', false);

	const owner = await Db.collections.User!.findOneOrFail();

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: true, user: owner });

	const response = await authOwnerAgent.get('/v1/executions/3');

	expect(response.statusCode).toBe(500);
});

test('GET /executions/:executionId should get an execution', async () => {
	const owner = await Db.collections.User!.findOneOrFail();

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: true, user: owner });

	const workflow = await testDb.createWorkflow({}, owner);

	const execution = await testDb.createSuccessfullExecution(workflow);

	const response = await authOwnerAgent.get(`/v1/executions/${execution.id}`);

	expect(response.statusCode).toBe(200);

	const {
		id,
		data,
		finished,
		mode,
		retryOf,
		retrySuccessId,
		startedAt,
		stoppedAt,
		workflowId,
		waitTill,
	} = response.body;

	expect(id).toBeDefined();
	expect(data).toBeDefined();
	expect(data).toEqual(execution.data);
	expect(finished).toBeDefined();
	expect(finished).toBe(true);
	expect(mode).toBeDefined();
	expect(mode).toEqual(execution.mode);
	expect(retrySuccessId).toBeDefined();
	expect(retrySuccessId).toBeNull();
	expect(retryOf).toBeDefined();
	expect(retryOf).toBeNull();
	expect(startedAt).toBeDefined();
	expect(stoppedAt).toBeDefined();
	expect(workflowId).toBeDefined();
	expect(workflowId).toBe(execution.workflowId);
	expect(waitTill).toBeDefined();
});

test('DELETE /executions/:executionId should fail due to missing API Key', async () => {
	const owner = await Db.collections.User!.findOneOrFail();

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: false, user: owner });

	const response = await authOwnerAgent.delete('/v1/executions/1');

	expect(response.statusCode).toBe(401);
});

test('DELETE /executions/:executionId should fail due to invalid API Key', async () => {
	const owner = await Db.collections.User!.findOneOrFail();

	owner.apiKey = null;

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: false, user: owner });

	const response = await authOwnerAgent.delete('/v1/executions/2');

	expect(response.statusCode).toBe(401);
});

test('DELETE /executions/:executionId should fail due no instance owner not setup', async () => {
	config.set('userManagement.isInstanceOwnerSetUp', false);

	const owner = await Db.collections.User!.findOneOrFail();

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: true, user: owner });

	const response = await authOwnerAgent.delete('/v1/executions/3');

	expect(response.statusCode).toBe(500);
});

test.skip('DELETE /executions/:executionId should delete an execution', async () => {
	const owner = await Db.collections.User!.findOneOrFail();

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: true, user: owner });

	const workflow = await testDb.createWorkflow({}, owner);

	const execution = await testDb.createSuccessfullExecution(workflow);

	const response = await authOwnerAgent.delete(`/v1/executions/${execution.id}`);

	expect(response.statusCode).toBe(200);

	const {
		id,
		data,
		finished,
		mode,
		retryOf,
		retrySuccessId,
		startedAt,
		stoppedAt,
		workflowId,
		waitTill,
	} = response.body;

	expect(id).toBeDefined();
	expect(data).toBeDefined();
	expect(data).toEqual(execution.data);
	expect(finished).toBeDefined();
	expect(finished).toBe(true);
	expect(mode).toBeDefined();
	expect(mode).toEqual(execution.mode);
	expect(retrySuccessId).toBeDefined();
	expect(retrySuccessId).toBeNull();
	expect(retryOf).toBeDefined();
	expect(retryOf).toBeNull();
	expect(startedAt).toBeDefined();
	expect(stoppedAt).toBeDefined();
	expect(workflowId).toBeDefined();
	expect(workflowId).toBe(execution.workflowId);
	expect(waitTill).toBeDefined();
});

test('GET /executions should fail due to missing API Key', async () => {
	const owner = await Db.collections.User!.findOneOrFail();

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: false, user: owner });

	const response = await authOwnerAgent.get('/v1/executions');

	expect(response.statusCode).toBe(401);
});

test('GET /executions should fail due to invalid API Key', async () => {
	const owner = await Db.collections.User!.findOneOrFail();

	owner.apiKey = null;

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: false, user: owner });

	const response = await authOwnerAgent.get('/v1/executions');

	expect(response.statusCode).toBe(401);
});

test('GET /executions should fail due no instance owner not setup', async () => {
	config.set('userManagement.isInstanceOwnerSetUp', false);

	const owner = await Db.collections.User!.findOneOrFail();

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: true, user: owner });

	const response = await authOwnerAgent.get('/v1/executions');

	expect(response.statusCode).toBe(500);
});

test('GET /executions should retrieve all successfull executions', async () => {
	const owner = await Db.collections.User!.findOneOrFail();

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: true, user: owner });

	const workflow = await testDb.createWorkflow({}, owner);

	const successfullExecution = await testDb.createSuccessfullExecution(workflow);

	await testDb.createErrorExecution(workflow);

	const response = await authOwnerAgent.get(`/v1/executions`).query({
		status: 'success',
	});

	expect(response.statusCode).toBe(200);
	expect(response.body.data.length).toBe(1);
	expect(response.body.nextCursor).toBe(null);

	const {
		id,
		data,
		finished,
		mode,
		retryOf,
		retrySuccessId,
		startedAt,
		stoppedAt,
		workflowId,
		waitTill,
	} = response.body.data[0];

	expect(id).toBeDefined();
	expect(data).toBeDefined();
	expect(data).toEqual(successfullExecution.data);
	expect(finished).toBeDefined();
	expect(finished).toBe(true);
	expect(mode).toBeDefined();
	expect(mode).toEqual(successfullExecution.mode);
	expect(retrySuccessId).toBeDefined();
	expect(retrySuccessId).toBeNull();
	expect(retryOf).toBeDefined();
	expect(retryOf).toBeNull();
	expect(startedAt).toBeDefined();
	expect(stoppedAt).toBeDefined();
	expect(workflowId).toBeDefined();
	expect(workflowId).toBe(successfullExecution.workflowId);
	expect(waitTill).toBeDefined();
});

test('GET /executions should retrieve all error executions', async () => {
	const owner = await Db.collections.User!.findOneOrFail();

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: true, user: owner });

	const workflow = await testDb.createWorkflow({}, owner);

	await testDb.createSuccessfullExecution(workflow);

	const errorExecution = await testDb.createErrorExecution(workflow);

	const response = await authOwnerAgent.get(`/v1/executions`).query({
		status: 'error',
	});

	expect(response.statusCode).toBe(200);
	expect(response.body.data.length).toBe(1);
	expect(response.body.nextCursor).toBe(null);

	const {
		id,
		data,
		finished,
		mode,
		retryOf,
		retrySuccessId,
		startedAt,
		stoppedAt,
		workflowId,
		waitTill,
	} = response.body.data[0];

	expect(id).toBeDefined();
	expect(data).toBeDefined();
	expect(data).toEqual(errorExecution.data);
	expect(finished).toBeDefined();
	expect(finished).toBe(false);
	expect(mode).toBeDefined();
	expect(mode).toEqual(errorExecution.mode);
	expect(retrySuccessId).toBeDefined();
	expect(retrySuccessId).toBeNull();
	expect(retryOf).toBeDefined();
	expect(retryOf).toBeNull();
	expect(startedAt).toBeDefined();
	expect(stoppedAt).toBeDefined();
	expect(workflowId).toBeDefined();
	expect(workflowId).toBe(errorExecution.workflowId);
	expect(waitTill).toBeDefined();
});

test('GET /executions should return all waiting executions', async () => {
	const owner = await Db.collections.User!.findOneOrFail();

	const authOwnerAgent = utils.createAgent(app, { apiPath: 'public', auth: true, user: owner });

	const workflow = await testDb.createWorkflow({}, owner);

	await testDb.createSuccessfullExecution(workflow);

	await testDb.createErrorExecution(workflow);

	const waitingExecution = await testDb.createWaitingExecution(workflow);

	const response = await authOwnerAgent.get(`/v1/executions`).query({
		status: 'waiting',
	});

	expect(response.statusCode).toBe(200);
	expect(response.body.data.length).toBe(1);
	expect(response.body.nextCursor).toBe(null);

	const {
		id,
		data,
		finished,
		mode,
		retryOf,
		retrySuccessId,
		startedAt,
		stoppedAt,
		workflowId,
		waitTill,
	} = response.body.data[0];

	expect(id).toBeDefined();
	expect(data).toBeDefined();
	expect(data).toEqual(waitingExecution.data);
	expect(finished).toBeDefined();
	expect(finished).toBe(false);
	expect(mode).toBeDefined();
	expect(mode).toEqual(waitingExecution.mode);
	expect(retrySuccessId).toBeDefined();
	expect(retrySuccessId).toBeNull();
	expect(retryOf).toBeDefined();
	expect(retryOf).toBeNull();
	expect(startedAt).toBeDefined();
	expect(stoppedAt).toBeDefined();
	expect(workflowId).toBeDefined();
	expect(workflowId).toBe(waitingExecution.workflowId);
	expect(waitTill).toBeDefined();
});

const INITIAL_TEST_USER = {
	id: uuid(),
	email: randomEmail(),
	firstName: randomName(),
	lastName: randomName(),
	password: randomValidPassword(),
	apiKey: randomApiKey(),
};
