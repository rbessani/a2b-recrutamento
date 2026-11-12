import assert from 'node:assert/strict';
import {uploadError,readUploadResponse,UPLOAD_SIZE_MESSAGE} from '../lib/uploads.mjs';
assert.equal(uploadError({size:4_000_000}),'');
assert.equal(uploadError({size:4_000_001}),UPLOAD_SIZE_MESSAGE);
assert.ok(uploadError({size:0}));
await assert.rejects(readUploadResponse(new Response('Request Entity Too Large',{status:413})),/4 MB/);
await assert.rejects(readUploadResponse(new Response('Bad gateway',{status:502})),/Não foi possível/);
assert.deepEqual(await readUploadResponse(Response.json({ok:true})),{ok:true});
console.log('6 verificações de upload passaram.');
