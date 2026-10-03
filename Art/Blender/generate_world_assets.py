"""Blender CLI: editable modular physical-world kit; no external textures/assets."""
import bpy
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
palette = {'concrete':'91a9ab','wood':'927457','metal':'526975','medical':'e2efea','industrial':'293e49','glass':'85bdce','water':'57acae','vegetation':'537964','emission':'93eadb','damage':'343d40'}
mats = {}
for name, color in palette.items():
    mat=bpy.data.materials.new(name); mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF')
    rgba=tuple(int(color[i:i+2],16)/255 for i in (0,2,4))+(1,)
    bs.inputs['Base Color'].default_value=rgba
    bs.inputs['Roughness'].default_value=.7
    bs.inputs['Metallic'].default_value=.3 if name in ['metal','industrial'] else 0
    if name=='emission':
        bs.inputs['Emission'].default_value=rgba
        bs.inputs['Emission Strength'].default_value=1.2
    mats[name]=mat
# Units and named pieces are runtime assembly contracts. Z-up converted by glTF.
pieces=[('wall',(1,.15,1),'concrete'),('roof',(1,1,.12),'metal'),('door',(1,.12,1),'wood'),('window',(1,.06,1),'glass'),('fence',(1,.1,.6),'metal'),('crate',(1,1,1),'wood'),('shelf',(1,.5,.12),'metal'),('bed',(1,1,.2),'medical'),('lamp',(.2,.2,.2),'emission'),('generator',(1,.7,.8),'industrial'),('radio',(.6,.4,.6),'metal'),('cabinet',(.7,.5,1),'medical'),('platform',(1,1,.15),'wood'),('bridge',(1,1,.2),'wood'),('debris',(.4,.4,.3),'damage'),('barricade',(1,.3,.5),'metal'),('sign',(1,.08,.5),'industrial'),('pipe',(.12,.12,1),'metal'),('cable',(.04,.04,1),'industrial')]
for name, dims, color in pieces:
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj=bpy.context.object; obj.name=name; obj.scale=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mats[color])
    # Keep origin-centred modules; source collections provide an assembly shelf.
    col=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(col)
    for c in list(obj.users_collection): c.objects.unlink(obj)
    col.objects.link(obj)
output=ROOT/'public/assets/world-kit.glb'
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Art/Blender/physical_world_kit.blend'))
print('Generated shared 19-piece kit, limited palette, editable source and GLB.')
