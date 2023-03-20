export interface ReceivedItem {
  dataUrl: string; 
  fileType: string;
}

/** Handle the event for a drag and dropped image or video file 
 * @returns the data url for the image or video file
*/
export async function dropItem(event: Event): Promise<ReceivedItem | undefined> {
  const e = event as CustomEvent<DragEvent>;
  const { items } = e.detail.dataTransfer!;
  const dataItems = [...items];
  const file = firstFile(dataItems);
  if (file) {
    return fileToUrl(file);
  }
  const item = firstUri(dataItems);
  if (item) {
    return {
      dataUrl: (await dataItemToString(item)) || "",
      fileType: "unknown",
    };
  }
  const videoItem = firstVideoUri(dataItems);
  if (videoItem) {
    return {
      dataUrl: (await dataItemToString(videoItem)) || "",
      fileType: "video/unknown",
    };
  }
}

function firstVideoUri(dataItems: DataTransferItem[]): DataTransferItem | undefined {
  const uriItems = dataItems.filter((i) => i.type === "video/uri-list");
  return uriItems[0] || undefined;
}

function firstUri(dataItems: DataTransferItem[]): DataTransferItem | undefined {
  const uriItems = dataItems.filter((i) => i.type === "text/uri-list");
  return uriItems[0] || undefined;
}

async function dataItemToString(dataItem: DataTransferItem): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    dataItem.getAsString((value: string | null) => resolve(value || undefined));
  });
}

function firstFile(dataItems: DataTransferItem[]): File | undefined {
  const files = dataItems.filter((i) => i.kind === "file").map((i) => i.getAsFile());
  return files[0] || undefined;
}

async function fileToUrl(file: File): Promise<ReceivedItem> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.readAsDataURL(file); // LATER encoding a video into a data URL is inefficient
    fileReader.onload = () =>
      resolve({
        dataUrl: fileReader.result as string,
        fileType: file.type,
      });
    fileReader.onerror = reject;
  });
}
