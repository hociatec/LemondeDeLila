"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _socialprofilesettingsservice = require("./social-profile-settings.service");
describe('SocialProfileSettingsService', ()=>{
    function createRepo() {
        let store = null;
        return {
            repo: {
                findOne: jest.fn(async ()=>store),
                insert: jest.fn(async (row)=>{
                    store = {
                        id: row.id ?? 1,
                        bioMinLength: row.bioMinLength ?? 0,
                        bioMaxLength: row.bioMaxLength ?? 500
                    };
                    return {
                        identifiers: [
                            {
                                id: store.id
                            }
                        ]
                    };
                }),
                save: jest.fn(async (row)=>{
                    store = {
                        id: row.id ?? store?.id ?? 1,
                        bioMinLength: row.bioMinLength ?? store?.bioMinLength ?? 0,
                        bioMaxLength: row.bioMaxLength ?? store?.bioMaxLength ?? 500
                    };
                    return store;
                })
            },
            getStore: ()=>store
        };
    }
    it('clamps min to max and caps max', async ()=>{
        const { repo } = createRepo();
        const svc = new _socialprofilesettingsservice.SocialProfileSettingsService(repo);
        const updated = await svc.update({
            bioMinLength: 999999,
            bioMaxLength: 200000
        });
        expect(updated.bioMaxLength).toBe(100000);
        expect(updated.bioMinLength).toBe(100000);
    });
    it('loads settings from repo after init', async ()=>{
        const { repo } = createRepo();
        const svc = new _socialprofilesettingsservice.SocialProfileSettingsService(repo);
        await svc.update({
            bioMinLength: 10,
            bioMaxLength: 20
        });
        const svc2 = new _socialprofilesettingsservice.SocialProfileSettingsService(repo);
        await svc2.onModuleInit();
        expect(svc2.get()).toEqual({
            bioMinLength: 10,
            bioMaxLength: 20
        });
    });
});
