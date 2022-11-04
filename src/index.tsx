import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { openFromUrl } from './client/fs/FileSystem';
import { Script } from './client/script/Script';
import { NpcDefinition } from './client/fs/definition/NpcDefinition';
import Bzip2 from "@foxglove/wasm-bz2";

import init, { compressGzip, decompressGzip } from "wasm-gzip/wasm_gzip.js";
import { ObjectDefinition } from './client/fs/definition/ObjectDefinition';
import { ItemDefinition } from './client/fs/definition/ItemDefinition';
import { ModelData } from './client/model/ModelData';
import { ParamManager } from './client/ParamManager';
import { ItemManager } from './client/ItemManager';
import { Scene } from './client/Scene';
import { ModelManager } from './client/ModelManager';

import { openDB, deleteDB } from 'idb';
import { IndexType } from './client/fs/IndexType';
import { ConfigType } from './client/fs/ConfigType';
import { Compression } from './client/util/Compression';
// import gzipWasm from "wasm-gzip/wasm_gzip_bg.wasm";
import registerServiceWorker from './registerServiceWorker';

async function test() {
  // for (let x = 0; x < 100; x++) {
  //   for (let y = 0; y < 100; y++) {
  //     if (Scene.generateHeight(x, y) != Scene.generateHeight_(x, y)) {
  //       console.log('Expected ' + Scene.generateHeight(x, y) + ' got ' + Scene.generateHeight_(x, y) + ' for ' + x + ', ' + y);
  //     }
  //   }
  // }

  // console.log('done');

  // if (1 === 1) {
  //   return;
  // }

  console.time('test');
  console.time('wasm');

  Compression.initWasm();
  console.timeEnd('wasm');

  if (1 == 1) {
    return;
  }

  // import("wasm-gzip/wasm_gzip_bg.wasm");

  // console.log(init);
  // await d5ly.setup();

  // hack to get wasm to load


  const fileSystem = await openFromUrl('/cache209/', [IndexType.CONFIGS, IndexType.MAPS, IndexType.MODELS, IndexType.SPRITES, IndexType.TEXTURES], true);
  // const fileSystem = await openFromUrl('/cache209/', [], true);
  // caches.open('cache-files').then(cache => {
  //   cache.addAll(['cache209/main_file_cache.dat2', 'cache209/keys.json']);
  // });
  // const db = await openDB('test-db', 1);

  console.timeEnd('test');

  let archiveCount = 0;
  fileSystem.indices.forEach(index => {
    console.log('index', index.id, index.getArchiveCount());
    archiveCount += index.getArchiveCount();
  });

  console.log(archiveCount);

  console.log(fileSystem.indices);

  const configIndex = fileSystem.getIndex(IndexType.CONFIGS);
  if (!configIndex) {
    throw new Error('Failed to load config index');
  }

  // console.time('read all archives');
  // const archives = Array.from(configIndex.getArchiveIds()).map(id => configIndex.getArchive(id));
  // console.timeEnd('read all archives');
  // console.log(archives);

  // const paramArchive = configIndex.getArchive(ConfigType.PARAMS);

  // const paramManager = new ParamManager(paramArchive);

  // console.time('read item archive');
  // const itemArchive = configIndex.getArchive(ConfigType.ITEM);
  // console.timeEnd('read item archive');

  // const itemManager = new ItemManager(itemArchive, paramManager, true);

  console.time('read');
  // const id = 73;
  // const scriptIndex = fileSystem.indices[12];
  // for (let i = 0; i < scriptIndex.getArchiveCount(); i++) {
  //   const scriptFile = scriptIndex.getFile(i, 0);
  //   if (scriptFile) {
  //     const script = new Script(scriptFile.archiveId);
  //     script.decode(scriptFile.getDataAsBuffer());
  //     // console.log(script);

  //   }
  // }
  console.timeEnd('read');

  // console.time('read npc archive');
  // const npcArchive = configIndex.getArchive(ConfigType.NPC);
  // console.timeEnd('read npc archive');

  // console.log(npcArchive.fileCount);
  // console.time('read npc');
  // for (let i = 0; i < npcArchive.fileCount; i++) {
  //   const npcFile = npcArchive.getFile(npcArchive.fileIds[i]);
  //   if (npcFile) {
  //     const npc = new NpcDefinition(npcFile.id);
  //     npc.decode(npcFile.getDataAsBuffer());
  //     // console.log(npc);
  //   }
  // }
  // console.timeEnd('read npc');

  console.time('read object archive');
  const objectArchive = configIndex.getArchive(ConfigType.OBJECT);
  console.timeEnd('read object archive');

  console.log('object count', objectArchive.fileCount);
  console.time('read object');
  const objects: Map<number, ObjectDefinition> = new Map();
  for (let i = 0; i < objectArchive.fileCount; i++) {
    // const objectFile = objectArchive.getFile(objectArchive.fileIds[i]);
    // if (objectFile) {
    //   const object = new ObjectDefinition(objectFile.id, false);
    //   object.decode(objectFile.getDataAsBuffer());
    //   object.post();
    //   // console.log(object);
    //   objects[object.id] = object;
    // }
  }
  console.timeEnd('read object');

  // document.body.innerText = 'hmm';

  // console.log(objects);

  // console.log('item count', itemManager.itemCount);
  // console.time('read item');
  // const items = [];
  // for (let i = 0; i < itemManager.itemCount; i++) {
  //   const item = itemManager.getDefinition(i);
  //   // console.log(item);
  //   items.push(item);
  // }
  // console.timeEnd('read item');

  // console.log(items.filter(item => item && item.op9));

  const modelIndex = fileSystem.getIndex(IndexType.MODELS);
  if (!modelIndex) {
    throw new Error('Failed to load config index');
  }

  console.log(modelIndex.getArchiveCount());

  // const modelManager = new ModelManager(modelIndex);

  console.time('read model');
  // let models: Promise<ModelData | undefined>[] = [];
  for (let i = 0; i < modelIndex.getArchiveCount(); i++) {
    // const file = modelIndex.getFile(i, 0);
    // if (file) {
    //   const model = ModelData.decode(file.data);
    // }
    // models.push(model);
    // console.log(model);
  }

  // await Promise.all(models).then((ms) => {
  //   console.log(ms);
  // });

  console.timeEnd('read model');

  const mapIndex = fileSystem.getIndex(IndexType.MAPS);
  if (!mapIndex) {
    throw new Error('Failed to load config index');
  }

  console.log('id', mapIndex.getArchiveId('l50_50'));
  console.log('id', mapIndex.getArchiveId('m50_50'));


  const xteas: any[] = await fetch('/cache209/keys.json').then(resp => resp.json());
  const xteasMap: Map<number, number[]> = new Map();
  xteas.forEach(xtea => xteasMap.set(xtea.group, xtea.key));

  const typeSizes: any = {
    "undefined": () => 0,
    "boolean": () => 4,
    "number": () => 8,
    "string": (item: any) => 2 * item.length,
    "object": (item: any) => !item ? 0 : Object
      .keys(item)
      .reduce((total: any, key: any) => sizeOf(key) + sizeOf(item[key]) + total, 0)
  };
  
  const sizeOf = (value: any) => typeSizes[typeof value](value);

  console.log(sizeOf(xteasMap));

  const mapFiles = [];

  const scene = new Scene(209, 4, 64, 64);

  console.time('land');

  label: for (let x = 0; x < 100; x++) {
    for (let y = 0; y < 200; y++) {
      if (x != 50 || y != 50) {
        continue;
      }
      const id = mapIndex.getArchiveId(`m${x}_${y}`);
      const landName = `l${x}_${y}`;
      const landId = mapIndex.getArchiveId(landName);
      if (id !== -1) {
        // const file = mapIndex.getFile(id, 0);
        // if (file) {
        //   scene.decodeMap(file.data, 0, 0, x * 64, y * 64);
        //   if (x == 50 && y == 50) {
        //     console.log(scene);
        //   }
        //   mapFiles.push(file);
        // }
      }
      if (landId !== -1 && xteasMap.get(landId)) {
        try {
          // const file = mapIndex.getFile(landId, 0, xteasMap.get(landId));
        } catch (e) {
          // throw e;
          throw new Error(`${x}_${y}`);
          console.log(x, y, xteasMap.get(landId), landId);
          // break label;
          break;
        }
        // await mapIndex.read(landId);
      }
    }
  }

  console.timeEnd('land');

  console.log(mapIndex.getArchiveId("l42_42"));

  // const landFile = mapIndex.getFile(mapIndex.getArchiveId("l42_42"), 0, [-320495055, -382048731, 1092278316, -1315718223]);
  // if (landFile) {
  //   console.log(landFile);
  // }

  console.log(mapIndex.getArchiveId("l41_42"));
  console.log(mapIndex.getArchive(mapIndex.getArchiveId("l41_42"), xteasMap.get(mapIndex.getArchiveId("l41_42"))));

  const models: Map<number, ModelData> = new Map();

  console.time('lumb');

  const checkRegion = "l50_54";

  const lumbLandscapeFile = mapIndex.getFile(mapIndex.getArchiveId(checkRegion), 0, xteasMap.get(mapIndex.getArchiveId(checkRegion)));
  if (lumbLandscapeFile) {
    const lumbObjectIds = scene.decodeLandscape(lumbLandscapeFile.getDataAsBuffer());
    console.log(lumbObjectIds);

    let faceCount = 0;
    let faceCountUnique = 0;

    let allModelIds: number[] = [];
    lumbObjectIds.forEach(({id, type}) => {
      let def = objects.get(id);
      if (!def) {
        const objectFile = objectArchive.getFile(id);
        if (objectFile) {
          def = new ObjectDefinition(id);
          def.decode(objectFile.getDataAsBuffer());
          def.post();
          objects.set(id, def);
        }
      }
      if (!def) {
        return;
      }

      const modelIds = [];

      if (def.objectTypes) {
        for (let i = 0; i < def.objectTypes.length; i++) {
          if (def.objectTypes[i] === type) {
            modelIds.push(def.objectModels[i]);
            break;
          }
        }
      }
      if (!modelIds.length && def.objectModels) {
        modelIds.push(...def.objectModels);
      }

      if (!modelIds.length) {
        return;
      }

      allModelIds.push(...modelIds);

      modelIds.forEach(modelId => {
        let model = models.get(modelId);
        if (!model) {
          const file = modelIndex.getFile(modelId, 0);
          if (file) {
            model = ModelData.decode(file.data);
            faceCountUnique += model.faceCount;
            models.set(modelId, model);
          }
        }
        if (!model) {
          return;
        }
        faceCount += model.faceCount;
      });

    });

    console.log(faceCount, faceCountUnique);
    console.log(new Set(lumbObjectIds.map(spawn => spawn.id)));

    console.log(new Set(allModelIds));
  }

  console.timeEnd('lumb');
  
}

test();

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

registerServiceWorker();
