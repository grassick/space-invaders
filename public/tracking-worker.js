/* Camera frames are processed here and never leave this device. */
let detector;
self.onmessage = async ({data}) => {
  try {
    if(data.type === 'init') {
      importScripts('vendor/vision_bundle.js');
      const files = await vision.FilesetResolver.forVisionTasks(new URL('vendor/wasm', self.location.href).href);
      detector = await vision.FaceDetector.createFromOptions(files, {
        baseOptions: {modelAssetPath:new URL('models/blaze_face_short_range.tflite', self.location.href).href,delegate:'CPU'},
        runningMode:'VIDEO', minDetectionConfidence:.5, minSuppressionThreshold:.3
      });
      self.postMessage({type:'ready'});
    } else if(data.type === 'frame') {
      try {
        const result=detector.detectForVideo(data.bitmap,data.time);
        const faces=result.detections.map(d=>{const b=d.boundingBox;return {x:1-(b.originX+b.width/2)/data.width,y:(b.originY+b.height/2)/data.height,w:b.width/data.width,h:b.height/data.height};});
        self.postMessage({type:'faces',faces,time:data.time});
      } finally {data.bitmap.close();}
    }
  } catch(error){self.postMessage({type:'error',message:error.message});}
};
