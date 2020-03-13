import { useCallback, useState, useEffect } from "react";
import { IStore, IVisibleRemainStat } from "./useFetchStores";
import { IMarker, ICustomOverlay } from "../Components/KakaoMap/types";
import { IMap, IMarkerClusterer } from "../Components/KakaoMap/types";
import _ from "lodash";
import "moment/locale/ko";
import moment from "moment";
import { statusString, rangeString } from "../constants";

type Params = {
  map: IMap | undefined;
  clusterMinLevel?: number;
  onClick?: (store: IStore) => void;
};

const markerIcon: { [key in IVisibleRemainStat]: string } = {
  plenty: "/images/marker-green.png",
  some: "/images/marker-yellow.png",
  few: "/images/marker-red.png",
  empty: "/images/marker-grey.png"
};

const getInfoWindow = (store: IStore) => `
<div class="custom_window">
  <div class="_window_col">
    <div style="display:flex; align-items:center">
      <div class="_window_title">${store.name}</div>
      <span class="distance">${store.distance} m</span>
    </div>
    <div style="white-space:normal; line-height: 1.3;">${store.addr}</div>
    <div>
      입고시간 : ${!!store.stock_at ? moment(new Date(store.stock_at)).fromNow() : "확인중"}
    </div>
    <div>
      업데이트 : ${!!store.created_at ? moment(new Date(store.created_at)).fromNow() : "확인중"}
    </div>
  </div>
  <div class="_window_col _stock" style="justify-content: center; align-items: center; display: ;">
    <span style="text-align: center; font-size: 14px;"> 재고수 </span>
    <span class="${store.remain_stat}" style="font-size: 20px;">
      ${statusString[store.remain_stat]}
    </span>
    ${
      store.remain_stat !== "break"
        ? `<span style="text-align: center;"> ${rangeString[store.visible_remain_stat]} </span>`
        : ""
    }
  </div>
</div>
  `;

export default ({ map, clusterMinLevel = 7, onClick = (store: IStore) => null }: Params) => {
  const [clusterer, setClusterer] = useState<IMarkerClusterer>();
  const [overlays, setOverlays] = useState<ICustomOverlay[]>([]);

  useEffect(() => {
    if (map) {
      setClusterer(
        new window.kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: clusterMinLevel,
          gridSize: 80,
          minClusterSize: 1
        })
      );
    }
  }, [map, clusterMinLevel]);

  useEffect(() => {
    if (map) {
      window.kakao.maps.event.addListener(map, "click", () => {
        overlays.forEach(overlay => overlay.setMap(null));
      });
    }
  }, [map, overlays]);

  const addMarker = useCallback(
    (
      oldMarkers: { [key in IVisibleRemainStat]: IMarker[] },
      newStores: IStore[],
      filterState?: { [key in IVisibleRemainStat]: boolean }
    ) => {
      const newMarkers: { [key in IVisibleRemainStat]: IMarker[] } = {
        plenty: [],
        some: [],
        few: [],
        empty: []
      };
      overlays.splice(0, overlays.length);
      let zIndex = 0;
      let testInfos: ICustomOverlay[] = [];

      const flattenMarkers = _.flatten(Object.values(oldMarkers));
      // Clear old Markers
      clusterer?.removeMarkers(flattenMarkers);
      flattenMarkers.forEach(marker => marker.setMap(null));
      let newInfos: ICustomOverlay[] = [];
      if (map) {
        newStores.forEach(store => {
          const icon = new window.kakao.maps.MarkerImage(
            markerIcon[store.visible_remain_stat],
            new window.kakao.maps.Size(28, 40),
            {
              offset: new window.kakao.maps.Point(16, 34),
              alt: "markerOfStore",
              shape: "rect"
              // coords: "1,20,1,9,5,2,10,0,21,0,27,3,30,9,30,20,17,33,14,33"
            }
          );

          const latlng = new window.kakao.maps.LatLng(store.lat, store.lng);
          const marker = new window.kakao.maps.Marker({
            position: latlng,
            image: icon
          });

          const customOverlay = new window.kakao.maps.CustomOverlay({
            position: latlng,
            content: getInfoWindow(store),
            clickable: true,
            xAnchor: 0.5,
            yAnchor: 1.5,
            zIndex: 999
          });
          testInfos.push(customOverlay);
          newInfos.push(customOverlay);

          // Event 등록
          window.kakao.maps.event.addListener(marker, "click", () => {
            zIndex += 1;
            testInfos.forEach(info => {
              if (info === customOverlay && !customOverlay.getMap()) {
                info.setMap(map);
              } else {
                info.setMap(null);
              }
            });
            marker.setZIndex(zIndex);
            map.panTo(latlng);
          });

          marker.setMap(map);

          newMarkers[store.visible_remain_stat].push(marker);

          return marker;
        });
        clusterer?.addMarkers(_.flatten(Object.values(newMarkers)));

        if (filterState) {
          Object.keys(filterState).forEach(key => {
            if (!filterState[key as IVisibleRemainStat]) {
              clusterer?.removeMarkers(newMarkers[key as IVisibleRemainStat]);
            }
          });
        }
        setOverlays(newInfos);
      }
      return { markers: newMarkers, overlays: newInfos };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, clusterer]
  );

  const setMarkersVisible = useCallback(
    (markers: IMarker[]) => {
      clusterer?.addMarkers(markers);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, clusterer]
  );

  const setMarkersHidden = useCallback(
    (markers: IMarker[]) => {
      clusterer?.removeMarkers(markers);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, clusterer]
  );

  return { addMarker, setMarkersVisible, setMarkersHidden };
};
