import { Card } from "@mtkit/ui";
import { Layout } from "./app/Layout";
import { mount } from "./app/mount";
import { LikeBurst } from "./features/components/LikeBurst";
import { WheelPicker } from "./features/components/WheelPicker";
import { ShaderLoaderCard } from "./features/components/loader/ShaderLoaderCard";
import { componentDemos } from "./features/components/content";
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
            <h2>{componentDemos.like.title}</h2>
            <p>{componentDemos.like.description}</p>
          </div>
        </Card>
        <Card className="component-preview">
          <div className="component-preview-stage"><WheelPicker /></div>
          <div className="component-preview-caption">
            <h2>{componentDemos.wheel.title}</h2>
            <p>{componentDemos.wheel.description}</p>
            <a className="inline-link" href={wheelLicense}>Лицензия MIT</a>
          </div>
        </Card>
      </div>
    </section>
  </Layout>,
);
