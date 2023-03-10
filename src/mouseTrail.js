import { Polyline, Renderer, Transform, Vec3, Color } from "ogl"

//   let characters = "abcdefghijklmnopqrstuvwxyz0123456789"
//     let hexColors = () => {
//         let hexChars = []
//         let colors = []
//         for(let i = 0; i < 10; i++)
//         {
//             hexChars = []
//             for(let j = 0; j < 6; j++)
//             {
//                 hexChars.push(`${characters[Math.floor(Math.random() * 36)]}`)
//             }
//             console.log(hexChars.join(''))
//             colors.push(`#${hexChars.join('')}`)
//         }

//        return colors;

//     } 



//     let randColors = hexColors()

const vertex = `
              attribute vec3 position;
              attribute vec3 next;
              attribute vec3 prev;
              attribute vec2 uv;
              attribute float side;
  
              uniform vec2 uResolution;
              uniform float uDPR;
              uniform float uThickness;
  
              vec4 getPosition() {
                  vec2 aspect = vec2(uResolution.x / uResolution.y, 1);
                  vec2 nextScreen = next.xy * aspect;
                  vec2 prevScreen = prev.xy * aspect;
  
                  vec2 tangent = normalize(nextScreen - prevScreen);
                  vec2 normal = vec2(-tangent.y, tangent.x);
                  normal /= aspect;
                  normal *= 1.0 - pow(abs(uv.y - 0.5) * 1.9, 2.0);
  
                  float pixelWidth = 1.0 / (uResolution.y / uDPR);
                  normal *= pixelWidth * uThickness;
  
                  // When the points are on top of each other, shrink the line to avoid artifacts.
                  float dist = length(nextScreen - prevScreen);
                  normal *= smoothstep(0.0, 0.02, dist);
  
                  vec4 current = vec4(position, 1);
                  current.xy -= normal * side;
                  return current;
              }
  
              void main() {
                  gl_Position = getPosition();
              }
          `;

const fragment = `
          uniform float u_intensity;
          uniform float u_time;
          
          varying vec2 vUv;
          varying float vDisplacement;
          
          void main() {
            float distort = 2.0 * vDisplacement * u_intensity;
          
            vec3 color = vec3(abs(vUv - 0.5) * 2.0  * (1.0 - distort), 1.0);
          
            gl_FragColor = vec4(color ,1.0);
  }
          
          `

{
    const renderer = new Renderer({ dpr: 2 });
    const gl = renderer.gl;
    document.body.appendChild(gl.canvas);
    gl.clearColor(0.9, 0.9, 0.9, 1);

    const scene = new Transform();

    const lines = [];

    function resize() {
        renderer.setSize(window.innerWidth, window.innerHeight);

        // We call resize on the polylines to update their resolution uniforms
        lines.forEach(line => line.polyline.resize());
    }
    window.addEventListener("resize", resize, false);

    // If you're interested in learning about drawing lines with geometry,
    // go through this detailed article by Matt DesLauriers
    // https://mattdesl.svbtle.com/drawing-lines-is-hard
    // It's an excellent breakdown of the approaches and their pitfalls.

    // In this example, we're making screen-space polylines. Basically it
    // involves creating a geometry of vertices along a path - with two vertices
    // at each point. Then in the vertex shader, we push each pair apart to
    // give the line some width.

    // Just a helper function to make the code neater
    function random(a, b) {
        const alpha = Math.random();
        return a * (1.0 - alpha) + b * alpha;
    }


    // We're going to make a number of different coloured lines for fun.
    ["#e09f7d", "#ef5d60", "#ec4067", "#a01a7d", "#311847"].forEach(
        (color, i) => {
            // Store a few values for each lines' randomised spring movement
            const line = {
                spring: random(.2, .5),
                friction: .99,
                mouseVelocity: new Vec3(),
                mouseOffset: new Vec3(random(-1, 1) * 0.05)
            };

            // Create an array of Vec3s (eg [[0, 0, 0], ...])

            const points = (line.points = []);


            const count = 500;

            for (let i = 0; i < count; i++) {
                const angle = i / (count - 2) * Math.PI * 2;
                const x = Math.cos(angle);
                const y = Math.sin(angle);
                const z = 0;

                points.push(new Vec3(x, y, z));
            };

            line.polyline = new Polyline(gl, {
                points,
                vertex,
                //fragment here?
                uniforms: {
                    uColor: { value: new Color(color) },
                    uThickness: { value: 12 }
                }
            });

            line.polyline.mesh.setParent(scene);

            lines.push(line);
        }
    );

    // Call initial resize after creating the polylines
    resize();

    // Add handlers to get mouse position
    const mouse = new Vec3();
    if ("ontouchstart" in window) {
        window.addEventListener("touchstart", updateMouse, false);
        window.addEventListener("touchmove", updateMouse, false);
    } else {
        window.addEventListener("mousemove", updateMouse, false);
    }

    function updateMouse(e) {
        if (e.changedTouches && e.changedTouches.length) {
            e.x = e.changedTouches[0].pageX;
            e.y = e.changedTouches[0].pageY;
        }
        if (e.x === undefined) {
            e.x = e.pageX;
            e.y = e.pageY;
        }

        // Get mouse value in -1 to 1 range, with y flipped
        mouse.set(
            (e.x / gl.renderer.width) * 2 - 1,
            (e.y / gl.renderer.height) * -2 + 1,
            0
        );
    }

    const tmp = new Vec3();

    requestAnimationFrame(update);
    function update(t) {
        requestAnimationFrame(update);

        lines.forEach(line => {
            // Update polyline input points
            for (let i = line.points.length - 1; i >= 0; i--) {
                if (!i) {
                    // For the first point, spring ease it to the mouse position
                    tmp
                        .copy(mouse)
                        .add(line.mouseOffset)
                        .sub(line.points[i])
                        .multiply(line.spring);
                    line.mouseVelocity.add(tmp).multiply(line.friction);
                    line.points[i].add(line.mouseVelocity);
                } else {
                    // The rest of the points ease to the point in front of them, making a line
                    line.points[i].lerp(line.points[i - 1], 1);
                }
            }
            line.polyline.updateGeometry();
        });

        renderer.render({ scene });
    }
}
