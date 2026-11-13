import { Card } from "@mtkit/ui";
import { Layout } from "./app/Layout";
import { mount } from "./app/mount";
import { LikeBurst } from "./features/components/LikeBurst";
import { WheelPicker } from "./features/components/WheelPicker";
import { ShaderLoaderCard } from "./features/components/loader/ShaderLoaderCard";
import wheelLicense from "./features/components/WHEEL-PICKER-LICENSE.txt?url&no-inline";

mount(
  <Layout page="components">
    <section className="page-container gallery-container component-library" aria-labelledby="component-library-title">
      <h1 id="component-library-title">Компоненты</h1>
      <div className="component-preview-grid">
        <ShaderLoaderCard />
        <Card className="component-preview">
          <div className="component-preview-stage"><LikeBurst /></div>
          <div className="component-preview-caption">
            <h2>Like Burst</h2>
            <p>Поставьте отметку «Нравится» и посмотрите, как меняется счётчик.</p>
          </div>
        </Card>
        <Card className="component-preview">
          <div className="component-preview-stage"><WheelPicker /></div>
          <div className="component-preview-caption">
            <h2>Wheel Picker</h2>
            <p>Выберите время колёсиком мыши, жестом или стрелками.</p>
            <a className="inline-link" href={wheelLicense}>Лицензия MIT</a>
          </div>
        </Card>
      </div>
    </section>
  </Layout>,
);
