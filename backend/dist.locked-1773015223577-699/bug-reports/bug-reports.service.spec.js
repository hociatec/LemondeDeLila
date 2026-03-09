"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _bugreportsservice = require("./bug-reports.service");
function createRepoStub() {
    const store = new Map();
    return {
        create: (entity)=>entity,
        save: (entity)=>{
            store.set(entity.id, entity);
            return Promise.resolve(entity);
        },
        find: ()=>Promise.resolve(Array.from(store.values())),
        findOne: ({ where })=>Promise.resolve(store.get(where.id) ?? null),
        delete: ({ id })=>Promise.resolve({
                affected: store.delete(id) ? 1 : 0
            })
    };
}
describe('BugReportsService', ()=>{
    it('creates and reads back', async ()=>{
        const repo = createRepoStub();
        const svc = new _bugreportsservice.BugReportsService(repo);
        const created = await svc.create({
            subject: ' Sujet ',
            content: ' Contenu ',
            createdByUserId: 1,
            createdByUsername: 'admin'
        });
        expect(created.status).toBe('pending');
        const got = await svc.get(created.id);
        expect(got?.subject).toBe('Sujet');
        expect(got?.content).toBe('Contenu');
    });
    it('updates and deletes', async ()=>{
        const repo = createRepoStub();
        const svc = new _bugreportsservice.BugReportsService(repo);
        const created = await svc.create({
            subject: 'Sujet',
            content: 'Contenu',
            createdByUserId: 1,
            createdByUsername: 'admin'
        });
        const updated = await svc.update(created.id, {
            subject: 'S2'
        });
        expect(updated?.subject).toBe('S2');
        const ok = await svc.delete(created.id);
        expect(ok).toBe(true);
        expect(await svc.get(created.id)).toBeNull();
    });
});
