"""Rebuild all Society robots with Blender 3.1+ in background mode."""
import bpy, math, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
EXPORTS = ROOT / 'Art' / 'Exports'
PUBLIC = ROOT / 'public' / 'assets'
EXPORTS.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)
COLORS = ['8ee6c0','eabc7e','86c6ef','ec827e','c6a0ed','f2bb9a','9caeee','c7d6d8','b8d983','da9bbe','78d8d1','e4d281']
NAMES = ['Nova','Atlas','Echo','Vex','Iris','Kairo','Lyra','Onyx','Sage','Rune','Pax','Juno']
def material(name, color, metallic=0, emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    rgba=tuple(int(color[i:i+2],16)/255 for i in (0,2,4))+(1,)
    bs.inputs['Base Color'].default_value=rgba
    bs.inputs['Metallic'].default_value=metallic; bs.inputs['Roughness'].default_value=.38
    if emission:
        bs.inputs['Emission'].default_value=rgba; bs.inputs['Emission Strength'].default_value=emission
    return m
def cube(name, pos, scale, mat, bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('soft machined edge','BEVEL'); mod.width=bevel; mod.segments=2
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(mat); return o
def sphere(name,pos,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=pos)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
white=material('ceramic shell','dee8e6',.25)
dark=material('graphite joint','182934',.55)
visor=material('obsidian visor','06141d',.65)
eye=material('cyan optics','7bebe8',.1,3)
for i,(name,color) in enumerate(zip(NAMES,COLORS)):
    collection=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(collection)
    before=set(bpy.data.objects)
    accent=material(name+' identity',color,.3)
    cube('Torso',(0,0,1.02),(.64,.4,.58),white,.1)
    cube('Chest plate',(0,-.225,1.06),(.4,.045,.34),accent,.04)
    sphere('Core light',(0,-.262,1.14),(.07,.028,.07),eye)
    cube('Head',(0,0,1.64),(.72+(i%3)*.07,.51,.55),white,.14 if i%3 else .08)
    cube('Visor',(0,-.262,1.64),(.56,.08,.31),visor,.09)
    for x in [-.14,.14]: sphere('Optic',(x,-.317,1.64),(.065,.025,.082),eye)
    for x in [-.43,.43]:
        sphere('Shoulder',(x,0,1.23),(.15,.17,.17),accent)
        cube('Arm',(x,0,.99),(.19,.23,.42),white)
        sphere('Hand',(x,-.01,.75),(.105,.12,.105),dark)
    for x in [-.18,.18]:
        sphere('Hip',(x,0,.67),(.14,.14,.14),dark)
        cube('Leg',(x,0,.4),(.23,.25,.38),white)
        cube('Boot',(x,-.07,.16),(.29,.41,.19),accent)
    cube('Pack',(0,.26,1.03),(.44,.23,.46),dark)
    cube('Belt',(0,0,.74),(.58,.43,.13),accent,.025)
    if i%4==0:
        cube('Antenna',(0,0,2.02),(.04,.04,.25),dark,.01); sphere('Antenna light',(0,0,2.15),(.07,.07,.07),accent)
    elif i%4==1:
        for x in [-.38,.38]: cube('Ear fins',(x,0,1.79),(.06,.27,.25),accent,.025)
    elif i%4==2: cube('Crest',(0,0,1.96),(.11,.36,.16),accent,.025)
    else: cube('Scout aerial',(.25,.05,2.0),(.055,.055,.28),dark,.01)
    parts=[o for o in bpy.data.objects if o not in before]
    for o in parts:
        for c in list(o.users_collection): c.objects.unlink(o)
        collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    # GLTF performs Blender Z-up -> Web Y-up conversion.
    bpy.ops.export_scene.gltf(filepath=str(EXPORTS / (name.lower()+'.glb')),export_format='GLB',use_selection=True,export_apply=True)
    (PUBLIC/(name.lower()+'.glb')).write_bytes((EXPORTS/(name.lower()+'.glb')).read_bytes())
    # Arrange the source collection for easy inspection without affecting exports.
    for o in parts:o.location.x+=(i%4)*2; o.location.y+=(i//4)*3
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Art'/'Blender'/'society_robots.blend'))
print('Generated 12 exported robots and editable Blender source.')
