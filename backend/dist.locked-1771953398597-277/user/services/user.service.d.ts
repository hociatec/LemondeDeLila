import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
export declare class UserService {
    private readonly users;
    constructor(users: Repository<User>);
    findAll(): Promise<User[]>;
    findOne(id: number): Promise<User>;
}
