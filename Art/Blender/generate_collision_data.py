"""Blender CLI collision/portal/approach authoring. No render-mesh parsing at runtime."""
import bpy, json, os, math
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
source = os.path.join(ROOT, 'Art', 'Blender', 'physical_world_kit.blend')
bpy.ops.wm.open_mainfile(filepath=source)
old = bpy.data.collections.get('SpatialMarkers')
if old:
    for o in list(old.objects): bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(old)
collection = bpy.data.collections.new('SpatialMarkers'); bpy.context.scene.collection.children.link(collection)
data = dict(collisionSchemaVersion=1, regions=[], colliders=[], portals=[], interactionSlots=[], terrainZones=[], verticalRoutes=[])
def marker(prefix, record, target):
    obj=bpy.data.objects.new(prefix+record['id'], None); collection.objects.link(obj)
    obj.empty_display_type='CUBE'; obj.location=(record.get('x',0),record.get('z',0),record.get('y',0))
    obj['spatial_record']=json.dumps(record,sort_keys=True); obj['export_group']=target
    data[target].append(record)
def box(id,x,z,w,d,kind='structure',region='outdoor',height=2):
    marker('COLLIDER_',dict(id=id,type='box',x=x,z=z,width=w,depth=d,height=height,kind=kind,region=region), 'colliders')
def region(id,x,z,w,d):
    marker('NAV_',dict(id=id,x=x,z=z,polygon=[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]]),'regions')
region('outdoor',0,0,56,56)
layouts=[('village',-10,12,['door','container','bed','campfire','generator','radio']),('clinic',-3,6,['door','medical_station','bed','container']),('watchtower',2,-19,['watchtower']),('ruins',10,-10,['door','container','campfire']),('depot',0,0,['container','radio']),('shelter',9,10,['bed','campfire','door']),('bridge',3,2,['watchtower']),('lake',-14,-5,['container'])]
for name,x,z,types in layouts:
    region(name,x,z,7,6)
    for i,kind in enumerate(types):
        ox=x if kind=='door' else x+((i%3)-1)*1.8
        if name=='depot' and kind=='radio': ox=x+.8
        oz=(9 if name=='village' else -12 if name=='ruins' else z-2) if kind=='door' else z+(i//3)*1.8
        oid=f'{name}_{kind}_{i}'
        if kind=='door':
            marker('PORTAL_',dict(id=oid,x=ox,z=oz,width=1.7,fromRegion='outdoor',toRegion=name,capacity=1,objectId=oid,state='dynamic'),'portals')
            for side in [-1,1]:
                marker('INTERACTION_',dict(id=oid+('_north' if side<0 else '_south'),objectId=oid,x=ox,z=oz+side*1.0,y=0,facing={'x':ox,'z':oz},capacity=1),'interactionSlots')
        elif kind=='watchtower':
            # Stair route has explicit horizontal travel and elevation, never a render-only teleport.
            nodes=[dict(x=ox+2.3,z=oz+2.4,y=0),dict(x=ox+2.3,z=oz,y=1.5),dict(x=ox,z=oz,y=3)]
            marker('NAV_',dict(id=oid,x=ox,z=oz,objectId=oid,width=1.15,nodes=nodes),'verticalRoutes')
            marker('INTERACTION_',dict(id=oid+'_top',objectId=oid,x=ox,z=oz,y=3,facing={'x':ox,'z':oz-1},capacity=1),'interactionSlots')
            for dx in [-1,1]:
                for dz in [-1,1]: box(oid+f'_support{dx}_{dz}',ox+dx,oz+dz,.15,.15,'column')
        else:
            size={'bed':(1.6,2.1),'generator':(1.6,1.1),'container':(1.45,1),'medical_station':(1.3,1),'radio':(.9,.8),'campfire':(.6,.6)}[kind]
            box(oid,ox,oz,*size,'equipment',name,1)
            for slot in range(2 if kind=='generator' else 1):
                marker('INTERACTION_',dict(id=oid+f'_slot{slot}',objectId=oid,x=ox+.95 if kind=='radio' else ox+(.48 if slot else -.48) if kind=='generator' else ox,z=oz if kind=='radio' else oz-size[1]/2-.48,y=0,facing={'x':ox,'z':oz},capacity=1),'interactionSlots')
    if name in ['clinic','shelter','depot']:
        front=z-2
        for side in [-1,1]:
            box(name+f'_front{side}',x+side*2.15,front,2.6,.16,'wall',name)
            if name=='depot' and side==1:
                # Existing bridge crosses the depot's east approach: leave a real side portal.
                box(name+'_side1',x+3.4,z-.85,.16,2.3,'wall',name)
                marker('PORTAL_',dict(id='depot_bridge',x=x+3.4,z=z+1.6,width=1.7,axis='x',fromRegion=name,toRegion='bridge',capacity=1,state='open'),'portals')
            else: box(name+f'_side{side}',x+side*3.4,z+.4,.16,4.8,'wall',name)
            for dz in [-2.8,2.8]: box(name+f'_column{side}_{dz}',x+side*3.4,z+dz,.15,.15,'column',name)
        box(name+'_back',x,z+2.8,6.8,.16,'wall',name)
        if name=='depot':
            marker('PORTAL_',dict(id='depot_entry',x=x,z=front,width=1.7,fromRegion='outdoor',toRegion=name,capacity=1,state='open'),'portals')
        for side in [-1,1]:
            if name=='clinic': box(name+f'_cabinet{side}',x+side*2.9,z+2.2,.65,.6,'furniture',name)
            if name=='depot':
                box(name+f'_rack{side}',x+side*2.8,z+(2.4 if side==1 else 1.7),.75,.5 if side==1 else 2,'furniture',name)
                box(name+f'_fence{side}',x+side*3.8,z-.9 if side==1 else z,.1,3.2 if side==1 else 5,'fence',name)
            if name=='shelter': box(name+f'_bench{side}',x+side*2.8,z+1.5,.5,2,'furniture',name)
    if name=='village':
        for side in [-1,1]:
            box(name+f'_front{side}',x+side*3.5,9,5,.35,'wall',name)
            box(name+f'_fence{side}',x+side*4.5,z+2,.1,4,'fence',name)
        for dx,dz in [(-3,2),(3,2),(-3,5),(3,5)]:
            for side in [-1,1]: box(f'village_post{dx}_{dz}_{side}',x+dx+side,z+dz,.14,.14,'column',name)
    if name=='bridge':
        for side in [-1,1]: box(name+f'_rail{side}',x,z+side*1.2,6,.12,'rail',name,1)
        for side in [-1,1]: marker('PORTAL_',dict(id=name+str(side),x=x+side*3,z=z,width=2.3,fromRegion='outdoor',toRegion=name,capacity=2,state='open'),'portals')
    if name=='ruins':
        for side in [-1,1]:box(name+f'_front{side}',x+side*3,-12,4,.35,'wall',name)
        for j in range(5):
            dx=math.cos(j*1.3)*3;dz=math.sin(j*1.3)*3
            box('ruin_column'+str(j),x+dx,z+dz,.45,.45,'column',name)
        marker('NAV_',dict(id='ruins_upper',x=x,z=z,objectId='ruins_container_1',width=1.2,nodes=[dict(x=x-1,z=z+2,y=0),dict(x=x-1,z=z,y=1),dict(x=x-1,z=z-1,y=1.3),dict(x=x+1,z=z-1,y=1.6)]),'verticalRoutes')
        for slot in data['interactionSlots']:
            if slot['objectId']=='ruins_container_1':slot.update(x=x+1,z=z-1,y=1.6,facing={'x':x+1,'z':z})
        for collider in data['colliders']:
            if collider['id']=='ruins_container_1':collider.update(x=x+1,z=z,y=1.6)
    if name=='lake':
        for collider in data['colliders']:
            if collider['id'].startswith('lake_container'): collider.update(x=x,z=z-3.8)
        marker('COLLIDER_',dict(id='deep_lake',type='circle',x=x,z=z,radius=2.65,height=0,kind='deep_water',region=name),'colliders')
        # Shore cache must be usable from land, not at the original underwater position.
        for slot in data['interactionSlots']:
            if slot['objectId'].startswith('lake_'):slot.update(x=x,z=z-4.7,facing={'x':x,'z':z-3.8})
for i,(x,z,r) in enumerate([(-20,8,1.1),(17,-5,.9),(7,18,1)]):
    marker('COLLIDER_',dict(id='large_rock'+str(i),type='circle',x=x,z=z,radius=r,height=2,kind='rock',region='outdoor'),'colliders')
for name,x,z,r,cost in [('road',0,4,3,.9),('grass',0,0,28,1),('forest',-18,-10,6,1.15),('rocky',15,-12,5,1.25),('shallow_water',-14,-5,3.7,1.4)]:
    marker('NAV_',dict(id=name,x=x,z=z,radius=r,cost=cost),'terrainZones')
# Serialize marker properties, not visual triangles. Slot adjustments above are reflected in markers.
for o in collection.objects:
    group=o['export_group']; rec=json.loads(o['spatial_record'])
    value=next(r for r in data[group] if r['id']==rec['id'])
    o.location=(value.get('x',0),value.get('z',0),value.get('y',0));o['spatial_record']=json.dumps(value,sort_keys=True)
data={k:([json.loads(o['spatial_record']) for o in collection.objects if o['export_group']==k] if isinstance(v,list) else v) for k,v in data.items()}
with open(os.path.join(ROOT,'public','assets','world-collision.json'),'w',encoding='utf8') as f:json.dump(data,f,sort_keys=True,indent=2);f.write('\n')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Art','Blender','world_collision.blend'))
print('EXPORTED SPATIAL MARKERS', {k:len(v) for k,v in data.items() if isinstance(v,list)})
