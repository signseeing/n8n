import SSEChannel from 'sse-channel';
import { Service } from 'typedi';
import { Logger } from '@/Logger';
import { AbstractPush } from './abstract.push';
import type { PushRequest, PushResponse } from './types';

type Connection = { req: PushRequest; res: PushResponse };

@Service()
export class SSEPush extends AbstractPush<Connection> {
	readonly channel = new SSEChannel();

	readonly connections: Record<string, Connection> = {};

	constructor(logger: Logger) {
		super(logger);
		this.channel.on('disconnect', (channel, { req }) => {
			this.remove(req?.query?.sessionId);
		});
	}

	add(sessionId: string, connection: Connection) {
		super.add(sessionId, connection);
		this.channel.addClient(connection.req, connection.res);
	}

	protected close({ res }: Connection): void {
		res.end();
		this.channel.removeClient(res);
	}

	protected sendToOne(connection: Connection, data: string): void {
		this.channel.send(data, [connection.res]);
	}
}
