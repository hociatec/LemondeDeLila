import Redis from 'ioredis';
export declare class RedisPubSubTransport<TEvent> {
    private readonly url;
    private readonly channel;
    private readonly createClient;
    private readonly publisher;
    private readonly subscriber;
    private readonly logger;
    constructor(url: string, channel: string, createClient?: (url: string, name: string) => Redis);
    connect(): Promise<void>;
    publish(event: TEvent): Promise<void>;
    subscribe(handler: (event: TEvent) => void): Promise<void>;
    disconnect(): Promise<void>;
}
