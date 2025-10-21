import { Args } from '@/runtime';
import { Input, Output } from "@/typings/connect/connect";

/**
  * Each file needs to export a function named `handler`. This function is the entrance to the Tool.
  * @param {Object} args.input - input parameters, you can get test input value by input.xxx.
  * @param {Object} args.logger - logger instance used to print logs, injected by runtime
  * @returns {*} The return data of the function, which should match the declared output parameters.
  * 
  * Remember to fill in input/output in Metadata, it helps LLM to recognize and use tool.
  */
export async function handler({ input, logger }: Args<Input>): Promise<Output> {
   const { images, texts, audios, durations } = params
    const ret = {
      "tracks": [
        {
          "id": "1",
          "title": "背景音乐",
          "type": "audio"
        },
        {
          "id": "2",
          "title": "视频",
          "type": "video"
        },
        {
          "id": "3",
          "title": "配音",
          "type": "audio"
        },
        {
          "id": "4",
          "title": "字幕",
          "type": "text"
        }
      ],
      "items": []
    }
  
    let start = 0
    durations.forEach((duration, i) => {
      ret.items.push({
        "type": "image",
        "data": {
          "path": images[i],
          "track": "2",
          "start": start,
          "duration": duration
        }
      })
      ret.items.push({
        "type": "subtitle",
        "data": {
          "text": texts[i],
          "track": "4",
          "start": start,
          "duration": duration
        }
      })
  
      ret.items.push({
        "type": "vocal",
        "data": {
          "path": audios[i],
          "track": "3",
          "start": start,
          "duration": duration
        }
      })
  
      start += duration
    })
  
    ret.items.push({
      "type": "music",
      "data": {
        "track": "1",
        "path": "D:/programming/pyJianYingDraft/test_data/2/bg.mp3",
        "start": 0,
        "duration": start
      }
    })
  
    return ret
};