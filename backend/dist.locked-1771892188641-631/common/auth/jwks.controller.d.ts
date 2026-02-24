import { ConfigService } from '@nestjs/config';
export declare class JwksController {
    private readonly config;
    constructor(config: ConfigService);
    jwks(): {
        keys: {
            use: string;
            alg: string;
            kid: string;
            crv?: string;
            d?: string;
            dp?: string;
            dq?: string;
            e?: string;
            k?: string;
            kty?: string;
            n?: string;
            p?: string;
            q?: string;
            qi?: string;
            x?: string;
            y?: string;
        }[];
    };
    jwksUnderApi(): {
        keys: {
            use: string;
            alg: string;
            kid: string;
            crv?: string;
            d?: string;
            dp?: string;
            dq?: string;
            e?: string;
            k?: string;
            kty?: string;
            n?: string;
            p?: string;
            q?: string;
            qi?: string;
            x?: string;
            y?: string;
        }[];
    };
    jwksApiAlias(): {
        keys: {
            use: string;
            alg: string;
            kid: string;
            crv?: string;
            d?: string;
            dp?: string;
            dq?: string;
            e?: string;
            k?: string;
            kty?: string;
            n?: string;
            p?: string;
            q?: string;
            qi?: string;
            x?: string;
            y?: string;
        }[];
    };
    jwksRootAlias(): {
        keys: {
            use: string;
            alg: string;
            kid: string;
            crv?: string;
            d?: string;
            dp?: string;
            dq?: string;
            e?: string;
            k?: string;
            kty?: string;
            n?: string;
            p?: string;
            q?: string;
            qi?: string;
            x?: string;
            y?: string;
        }[];
    };
}
