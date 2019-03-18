import PouchDB from "pouchdb";
import PouchDBMemoryAdapter from "pouchdb-adapter-memory";
import PouchDBFind from "pouchdb-find";

import { soliditySha3 } from "web3-utils";

const resources = {
  contracts: {
    createIndexes: [
    ]
  },
  contractConstructors: {
    createIndexes: [
    ]
  },
  sources: {
    createIndexes: [
      { fields: ["contents"] },
      { fields: ["sourcePath"] },
    ]
  },
  compilations: {
    createIndexes: [
    ]
  },
  bytecodes: {
    createIndexes: [
    ]
  }
}

export class Workspace {
  sources: PouchDB.Database;
  bytecodes: PouchDB.Database;
  compilations: PouchDB.Database;
  contracts: PouchDB.Database;
  contractConstructors: PouchDB.Database;

  private ready: Promise<void>;

  constructor () {
    PouchDB.plugin(PouchDBMemoryAdapter);
    PouchDB.plugin(PouchDBFind);

    for (let resource of Object.keys(resources)) {
      this[resource] = new PouchDB(resource, { adapter: "memory" });
    }

    this.ready = this.initialize();
  }

  async initialize() {
    for (let [resource, definition] of Object.entries(resources)) {
      const db = this[resource];

      const { createIndexes } = definition;

      for (let index of (createIndexes || [])) {
        await db.createIndex({ index });
      }
    }
  }

  async contractNames () {
    await this.ready;

    const { docs }: any = await this.contracts.find({
      selector: {},
      fields: ['name']
    })
    return docs.map( ({ name }) => name );
  }

  async contract ({ id }: { id: string }) {
    await this.ready;

    try {
      const result = {
        ...await this.contracts.get(id), 

        id
      }
      return result;
    } catch (_) {
      return null;
    }
  }

  async contractsAdd({input}) {
    await this.ready;

    const { contracts } = input;
    
    return {
      contracts: Promise.all(contracts.map(
        async (contractInput) => {
          const { name, source } = contractInput;
          const id = name !== undefined ? soliditySha3(name, source.id) : soliditySha3(source.id);
          const contract = await this.contract( { id } );
          
          if(contract) {
            return contract;
          } else {
            await this.contracts.put({
            ...contractInput, 
            _id: id,
            });
           
            return { name, source, id };
          }
        }
      ))
    }
  }

  async contractConstructor ({ id }: { id: string }) {
    await this.ready;
   
    try {
      const result = {
        ...await this.contractConstructors.get(id), 

        id
      }

      return result;
    } catch (_) {
      return null;
    }
  }

  async contractConstructorsAdd({input}) {
    await this.ready;

    const { contractConstructors } = input;
    
    return {
      contractConstructors: Promise.all(contractConstructors.map(
        async (contractConstructorInput) => {
          const { abi, compilation, createBytecode,linkValues, contract  } = contractConstructorInput;
          const id = abi !== undefined? soliditySha3(abi, createBytecode.id) : soliditySha3(createBytecode.id);
         
          const contractConstructor = await this.contractConstructor( { id } );
         
          if(contractConstructor) {
            return contractConstructor;
          } else {
            let result = await this.contractConstructors.put({
            ...contractConstructorInput, 
            
            _id: id,
            });
           
            return await this.contractConstructor({ id });
          }
        }
      ))
    }
  }

  async compilation ({ id }: { id: string }) {
    await this.ready;

    try {
      return  {
        ... await this.compilations.get(id),

        id
      };

    } catch (_) {
      return null;
    }
  }

  async compilationsAdd ({ input }) {
    await this.ready;

    const { compilations } = input;

    return {
      compilations: Promise.all(compilations.map(
        async (compilationInput) => {
         const { compiler, contractTypes, sources } = compilationInput;

         const sourceIds = sources.map(source => source.id);
         const sourcesObject = Object.assign({}, sourceIds);

         const id = soliditySha3(compiler.id, sourcesObject);

         const compilation = await this.compilation({ id }) || { ...compilationInput, id };

          await this.compilations.put({
            ...compilation,
            ...compilationInput,


            _id: id
          });

          return compilation;
        }
      ))
    };
  }



  async source ({ id }: { id: string }) {
    await this.ready;

    try {
      return {
        ...await this.sources.get(id),

        id
      };
    } catch (_) {
      return null;
    }
  }

  async sourcesAdd ({ input }) {
    await this.ready;

    const { sources } = input;

    return {
      sources: Promise.all(sources.map(
        async (sourceInput) => {
          const { contents, sourcePath } = sourceInput;
          // hash includes sourcePath because two files can have same contents, but
          // should have different IDs
          const id = (sourcePath)
            ? soliditySha3(contents, sourcePath)
            : soliditySha3(contents)

          const source = await this.source({ id }) || { ...sourceInput, id };

          await this.sources.put({
            ...source,
            ...sourceInput,

            _id: id
          });

          return source;
        }
      ))
    };
  }

  async bytecode ({ id }: { id: string }) {
    await this.ready;

    try {
      return {
        ...await this.bytecodes.get(id),

        id
      };
    } catch (_) {
      return null;
    }
  }

  async bytecodesAdd ({ input }) {
    await this.ready;

    const { bytecodes } = input;

    return {
      bytecodes: await Promise.all(bytecodes.map(
        async (bytecodeInput) => {
          const { bytes } = bytecodeInput;

          const id = soliditySha3(bytes);

          const bytecode = await this.bytecode({ id }) || { ...bytecodeInput, id };

          await this.bytecodes.put({
            ...bytecode,
            ...bytecodeInput,

            _id: id
          });

          return bytecode;
        }
      ))
    };
  }
}