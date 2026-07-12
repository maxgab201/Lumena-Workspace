import { usePageRegistryStore } from '../../../stores/pageRegistryStore';
import { useViewerStore } from '../../../stores/viewerStore';

interface LayoutOverlayProps {
  pageIndex: number;
}

export const LayoutOverlay = ({ pageIndex }: LayoutOverlayProps) => {
  const page = usePageRegistryStore((state) => state.pages[pageIndex]);
  const showOverlays = useViewerStore((state) => state.showOverlays);

  if (!showOverlays || !page || page.layoutStatus !== 'completed' || !page.layoutData?.data) {
    return null;
  }

  const { elements } = page.layoutData.data;

  const getColorForType = (type: string) => {
    switch (type) {
      case 'title': return 'border-blue-500 bg-blue-500/10';
      case 'paragraph': return 'border-green-500 bg-green-500/10';
      case 'table': return 'border-orange-500 bg-orange-500/10';
      case 'image': return 'border-purple-500 bg-purple-500/10';
      case 'list': return 'border-yellow-500 bg-yellow-500/10';
      case 'header': return 'border-gray-500 bg-gray-500/10';
      case 'footer': return 'border-gray-500 bg-gray-500/10';
      default: return 'border-red-500 bg-red-500/10';
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {elements.map((el) => {
        const [x0, y0, x1, y1] = el.bbox;
        const left = `${x0 * 100}%`;
        const top = `${y0 * 100}%`;
        const width = `${(x1 - x0) * 100}%`;
        const height = `${(y1 - y0) * 100}%`;

        return (
          <div
            key={el.id}
            className={`absolute border-2 ${getColorForType(el.type)} pointer-events-auto group hover:bg-opacity-30 transition-colors`}
            style={{ left, top, width, height }}
            title={`${el.type} (${Math.round(el.confidence * 100)}%)`}
          >
            <span className="absolute -top-5 left-0 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {el.type}
            </span>
          </div>
        );
      })}
    </div>
  );
};
